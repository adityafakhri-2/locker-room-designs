import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          console.log("[Webhook Mayar] Menerima payload webhook:", body);

          const { event, data } = body;

          // Periksa apakah event adalah pembayaran diterima (payment.received)
          if (event === "payment.received") {
            const extraData = data?.extraData;
            const orderId = extraData?.order_id;

            if (orderId) {
              console.log(`[Webhook Mayar] Memproses pembayaran sukses untuk Order ID: ${orderId}`);

              // 0. Verifikasi out-of-band ke Mayar API untuk memvalidasi keaslian status pembayaran (Defense in Depth)
              const invoiceId = data?.id;
              if (!invoiceId) {
                console.error("[Webhook Mayar] Payload tidak memiliki invoice ID.");
                return new Response(JSON.stringify({ error: "Invoice ID tidak ditemukan dalam payload" }), {
                  status: 400,
                  headers: { "Content-Type": "application/json" },
                });
              }

              const mayarApiKey = process.env.MAYAR_API_KEY;
              if (mayarApiKey) {
                console.log(`[Webhook Mayar] Memverifikasi invoice ${invoiceId} ke API Mayar...`);
                const checkResponse = await fetch(`https://api.mayar.id/hl/v1/invoice/${invoiceId}`, {
                  method: "GET",
                  headers: {
                    Authorization: `Bearer ${mayarApiKey}`,
                  },
                });

                if (!checkResponse.ok) {
                  console.error(`[Webhook Mayar] Gagal menghubungi API Mayar untuk invoice ${invoiceId}`);
                  return new Response(JSON.stringify({ error: "Gagal memverifikasi pembayaran dengan provider" }), {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                  });
                }

                const checkData = await checkResponse.json();
                const verifiedStatus = checkData?.data?.status || checkData?.status;

                if (verifiedStatus !== "paid") {
                  console.error(`[Webhook Mayar] Pembayaran tidak valid. Status di Mayar: ${verifiedStatus}`);
                  return new Response(JSON.stringify({ error: `Status pembayaran tidak valid: ${verifiedStatus}` }), {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                  });
                }

                console.log(`[Webhook Mayar] Invoice ${invoiceId} terverifikasi lunas (paid) via Mayar API.`);
              } else {
                if (process.env.NODE_ENV === "production") {
                  console.error("[Webhook Mayar] ERROR: MAYAR_API_KEY tidak dikonfigurasi di lingkungan produksi!");
                  return new Response(
                    JSON.stringify({ error: "Konfigurasi API Key tidak lengkap untuk memproses pembayaran." }),
                    {
                      status: 500,
                      headers: { "Content-Type": "application/json" },
                    }
                  );
                }
                console.warn("[Webhook Mayar] MAYAR_API_KEY tidak dikonfigurasi. Menjalankan mode simulasi tanpa verifikasi API.");
              }

              // Impor supabaseAdmin secara dinamis hanya di dalam handler server
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

              // 1. Cari transaksi pembayaran yang terkait dengan order_id
              const { data: payment, error: pErr } = await supabaseAdmin
                .from("payments")
                .select("id, status")
                .eq("order_id", orderId)
                .maybeSingle();

              if (pErr) {
                console.error("[Webhook Mayar] Gagal mencari data pembayaran:", pErr);
                return new Response(JSON.stringify({ error: pErr.message }), { status: 500 });
              }

              if (!payment) {
                console.warn(
                  "[Webhook Mayar] Data pembayaran tidak ditemukan untuk Order ID:",
                  orderId,
                );
                return new Response(JSON.stringify({ error: "Data pembayaran tidak ditemukan" }), {
                  status: 404,
                });
              }

              // 2. Jika status pembayaran belum disetujui (approved), perbarui statusnya
              if (payment.status !== "approved") {
                const { error: uErr } = await supabaseAdmin
                  .from("payments")
                  .update({
                    status: "approved",
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", payment.id);

                if (uErr) {
                  console.error(
                    "[Webhook Mayar] Gagal memperbarui status pembayaran ke approved:",
                    uErr,
                  );
                  return new Response(JSON.stringify({ error: uErr.message }), { status: 500 });
                }

                console.log(
                  `[Webhook Mayar] Pembayaran berhasil disetujui untuk Order ID: ${orderId}. Database trigger akan otomatis mengubah status pesanan menjadi 'processing' (dikemas).`,
                );
              } else {
                console.log(
                  "[Webhook Mayar] Pembayaran untuk Order ID tersebut sudah disetujui sebelumnya.",
                );
              }
            } else {
              console.warn(
                "[Webhook Mayar] Properti order_id tidak ditemukan di extraData:",
                extraData,
              );
            }
          } else {
            console.log(`[Webhook Mayar] Mengabaikan event: ${event}`);
          }

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("[Webhook Mayar] Gagal memproses webhook:", err);
          return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
        }
      },
    },
  },
});
