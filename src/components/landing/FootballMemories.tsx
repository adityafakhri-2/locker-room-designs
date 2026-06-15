import img from "@/assets/football-memories.jpg";

export function FootballMemories() {
  return (
    <section className="relative bg-foreground text-background overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={img}
          alt="Empty locker room at night with jerseys hanging in cubbies"
          loading="lazy"
          width={1920}
          height={1080}
          className="size-full object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground via-foreground/40 to-foreground/70" />
      </div>

      <div className="relative container-swiss py-28 md:py-40 lg:py-48">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 mb-12">
          <span className="eyebrow text-white/70">N° 10 — Memories</span>
          <span className="eyebrow text-white/70">Editorial</span>
        </div>

        <h2 className="display-xl text-white max-w-5xl">
          Setiap jersey
          <br />
          <span className="italic font-light">menyimpan cerita.</span>
        </h2>

        <p className="mt-10 max-w-2xl text-base md:text-lg leading-relaxed text-white/80">
          Dari malam final Liga Champions hingga momen kejayaan tim nasional,
          setiap jersey memiliki sejarah yang layak dikenang. Kami merawatnya
          agar cerita itu tidak pernah memudar.
        </p>
      </div>
    </section>
  );
}
