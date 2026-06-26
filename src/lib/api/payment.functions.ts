import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createMayarPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      orderId: z.string().uuid(),
      orderNumber: z.string().min(1),
      amount: z.number().positive(),
      customerName: z.string().min(1),
      customerEmail: z.string().email().or(z.string().length(0)),
      customerMobile: z.string().min(1),
      redirectUrl: z.string().url(),
    }),
  )
  .handler(async ({ data, context }) => {
    // 1. Verifikasi kepemilikan pesanan
    const { data: order, error: orderErr } = await context.supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", data.orderId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (orderErr || !order) {
      throw new Error("Pesanan tidak ditemukan atau Anda tidak memiliki akses.");
    }

    // 2. Rekalkulasi dan verifikasi total harga di sisi server (mencegah manipulasi harga)
    const productIds = order.order_items.map((i: any) => i.product_id);
    const { data: products, error: pErr } = await context.supabase
      .from("products")
      .select("id, price")
      .in("id", productIds);

    if (pErr || !products) {
      throw new Error("Gagal mengambil data produk untuk verifikasi.");
    }

    let expectedSubtotal = 0;
    for (const item of order.order_items) {
      const product = products.find((p) => p.id === item.product_id);
      if (!product) {
        throw new Error(`Produk dengan ID ${item.product_id} tidak ditemukan.`);
      }
      expectedSubtotal += Number(product.price) * item.quantity;
    }

    let expectedDiscount = 0;
    if (order.voucher_id) {
      const { data: voucher, error: vErr } = await context.supabase
        .from("vouchers")
        .select("*")
        .eq("id", order.voucher_id)
        .maybeSingle();

      if (vErr || !voucher) {
        throw new Error("Voucher tidak valid.");
      }

      if (voucher.end_date && new Date(voucher.end_date) < new Date()) {
        throw new Error("Voucher sudah kadaluarsa.");
      }

      if (voucher.discount_type === "percentage") {
        expectedDiscount = (expectedSubtotal * voucher.discount_value) / 100;
        if (voucher.max_discount) {
          expectedDiscount = Math.min(expectedDiscount, voucher.max_discount);
        }
      } else if (voucher.discount_type === "fixed") {
        expectedDiscount = voucher.discount_value;
      }
      expectedDiscount = Math.min(expectedDiscount, expectedSubtotal);
    }

    const expectedGrandTotal = expectedSubtotal + Number(order.shipping_cost) - expectedDiscount;

    if (Math.abs(Number(order.grand_total) - expectedGrandTotal) > 1) {
      throw new Error("Kecurangan terdeteksi: Total harga pesanan tidak valid.");
    }

    const verifiedAmount = Number(order.grand_total);
    const apiKey = process.env.MAYAR_API_KEY;

    if (!apiKey) {
      console.warn(
        "[Mayar API] MAYAR_API_KEY tidak dikonfigurasi. Menggunakan tautan pembayaran simulasi (mock).",
      );
      return {
        success: true,
        link: `${data.redirectUrl}?mock_paid=true`,
        invoiceId: `mock-inv-${Date.now()}`,
      };
    }

    try {
      console.log(
        `[Mayar API] Mengirim permintaan pembuatan invoice untuk pesanan ${data.orderNumber} dengan nominal ${verifiedAmount}`,
      );

      const payload = {
        name: data.customerName,
        email: data.customerEmail || "customer@example.com", // Mayar mewajibkan email
        mobile: data.customerMobile,
        amount: verifiedAmount,
        redirectUrl: data.redirectUrl,
        description: `Pembayaran Pesanan #${data.orderNumber} - The Locker Room`,
        items: [
          {
            quantity: 1,
            rate: verifiedAmount,
            description: `Total Pembayaran Pesanan #${data.orderNumber}`,
          },
        ],
        extraData: {
          order_id: data.orderId,
          order_number: data.orderNumber,
        },
      };

      const response = await fetch("https://api.mayar.id/hl/v1/invoice/create", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseErr) {
        throw new Error(`Gagal mem-parse respon Mayar: ${responseText}`);
      }

      if (!response.ok) {
        console.error("[Mayar API] Respon error dari Mayar:", responseData);
        throw new Error(
          responseData?.message || `Permintaan gagal dengan status ${response.status}`,
        );
      }

      console.log("[Mayar API] Invoice berhasil dibuat:", responseData);

      // Mayar mengembalikan link invoice dalam format responseData.data.link
      return {
        success: true,
        link: responseData?.data?.link || responseData?.link,
        invoiceId: responseData?.data?.id || responseData?.id,
      };
    } catch (err) {
      console.error("[Mayar API] Error saat membuat invoice Mayar:", err);
      throw new Error(`Integrasi Mayar Error: ${(err as Error).message}`);
    }
  });

export const checkMayarPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      paymentId: z.string().uuid(),
      invoiceId: z.string().min(1),
    }),
  )
  .handler(async ({ data, context }) => {
    // 1. Verifikasi kepemilikan pembayaran dan pesanan (mencegah IDOR)
    const { data: payment, error: paymentErr } = await context.supabase
      .from("payments")
      .select("id, status, order_id")
      .eq("id", data.paymentId)
      .maybeSingle();

    if (paymentErr || !payment) {
      throw new Error("Data pembayaran tidak ditemukan.");
    }

    const { data: order, error: orderErr } = await context.supabase
      .from("orders")
      .select("user_id")
      .eq("id", payment.order_id)
      .maybeSingle();

    if (orderErr || !order || order.user_id !== context.userId) {
      throw new Error("Unauthorized: Anda tidak berwenang memeriksa status pembayaran ini.");
    }
    const apiKey = process.env.MAYAR_API_KEY;

    if (!apiKey) {
      return { success: false, status: "mock_mode" };
    }

    try {
      console.log(
        `[Mayar API] Memeriksa status invoice ${data.invoiceId} untuk Pembayaran ${data.paymentId}`,
      );

      const response = await fetch(`https://api.mayar.id/hl/v1/invoice/${data.invoiceId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Mayar API status check returned ${response.status}`);
      }

      const responseData = await response.json();
      const status = responseData?.data?.status;

      console.log(`[Mayar API] Status invoice dari Mayar: ${status}`);

      if (status === "paid") {
        // Impor supabaseAdmin secara dinamis di server
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { error } = await supabaseAdmin
          .from("payments")
          .update({
            status: "approved",
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.paymentId);

        if (error) {
          throw new Error(`Gagal memperbarui status pembayaran: ${error.message}`);
        }

        console.log(`[Mayar API] Pembayaran ${data.paymentId} berhasil di-approve di DB`);
        return { success: true, status: "paid" };
      }

      return { success: true, status };
    } catch (err) {
      console.error("[Mayar API] Gagal memeriksa status invoice Mayar:", err);
      throw new Error(`Gagal memeriksa status pembayaran: ${(err as Error).message}`);
    }
  });
