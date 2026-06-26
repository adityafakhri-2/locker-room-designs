import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const createMayarPayment = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      orderId: z.string().uuid(),
      orderNumber: z.string().min(1),
      amount: z.number().positive(),
      customerName: z.string().min(1),
      customerEmail: z.string().email().or(z.string().length(0)),
      customerMobile: z.string().min(1),
      redirectUrl: z.string().url(),
    })
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.MAYAR_API_KEY;

    if (!apiKey) {
      console.warn("[Mayar API] MAYAR_API_KEY tidak dikonfigurasi. Menggunakan tautan pembayaran simulasi (mock).");
      return {
        success: true,
        link: `${data.redirectUrl}?mock_paid=true`,
        invoiceId: `mock-inv-${Date.now()}`,
      };
    }

    try {
      console.log(`[Mayar API] Mengirim permintaan pembuatan invoice untuk pesanan ${data.orderNumber} dengan nominal ${data.amount}`);
      
      const payload = {
        name: data.customerName,
        email: data.customerEmail || "customer@example.com", // Mayar mewajibkan email
        mobile: data.customerMobile,
        amount: data.amount,
        redirectUrl: data.redirectUrl,
        description: `Pembayaran Pesanan #${data.orderNumber} - The Locker Room`,
        items: [
          {
            quantity: 1,
            rate: data.amount,
            description: `Total Pembayaran Pesanan #${data.orderNumber}`
          }
        ],
        extraData: {
          order_id: data.orderId,
          order_number: data.orderNumber,
        },
      };

      const response = await fetch("https://api.mayar.id/hl/v1/invoice/create", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
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
        throw new Error(responseData?.message || `Permintaan gagal dengan status ${response.status}`);
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
  .inputValidator(
    z.object({
      paymentId: z.string().uuid(),
      invoiceId: z.string().min(1),
    })
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.MAYAR_API_KEY;

    if (!apiKey) {
      return { success: false, status: "mock_mode" };
    }

    try {
      console.log(`[Mayar API] Memeriksa status invoice ${data.invoiceId} untuk Pembayaran ${data.paymentId}`);
      
      const response = await fetch(`https://api.mayar.id/hl/v1/invoice/${data.invoiceId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
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
            updated_at: new Date().toISOString()
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
