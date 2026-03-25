export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          SOMA{" "}
          <span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
            Chat
          </span>
        </h1>
        <p className="mt-4 max-w-lg text-lg text-[#8b8b9e]">
          Un assistant IA pour votre site, en 5 minutes.
        </p>

        {/* URL Form */}
        <div className="mt-10 flex w-full max-w-md gap-3">
          <input
            type="url"
            placeholder="https://votre-site.com"
            className="flex-1 rounded-lg border border-[#2a2a34] bg-[#111118] px-4 py-3 text-sm text-[#f0f0f3] placeholder-[#55556a] outline-none focus:border-blue-500 transition-colors"
            disabled
          />
          <button
            disabled
            className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white opacity-50 cursor-not-allowed"
          >
            Cr&eacute;er
          </button>
        </div>
        <p className="mt-3 text-xs text-[#55556a]">
          Bient&ocirc;t disponible &mdash; pipeline CLI uniquement pour le
          moment.
        </p>
      </section>

      {/* How it works */}
      <section className="border-t border-[#1f1f28] px-6 py-20">
        <h2 className="text-center text-2xl font-semibold mb-12">
          Comment &ccedil;a marche
        </h2>
        <div className="mx-auto grid max-w-3xl gap-8 sm:grid-cols-3">
          {[
            {
              step: "1",
              title: "Entrez votre URL",
              desc: "On prend l\u2019URL de votre site et on crawle toutes les pages publiques.",
            },
            {
              step: "2",
              title: "On indexe votre contenu",
              desc: "Le contenu est d\u00e9coup\u00e9 en chunks, transform\u00e9 en vecteurs et stock\u00e9 dans Qdrant.",
            },
            {
              step: "3",
              title: "Collez le script",
              desc: "Un simple <script> \u00e0 ajouter dans votre HTML. Le chatbot appara\u00eet en bas \u00e0 droite.",
            },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600/20 text-blue-400 font-bold text-lg">
                {item.step}
              </div>
              <h3 className="font-medium mb-2">{item.title}</h3>
              <p className="text-sm text-[#8b8b9e]">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1f1f28] px-6 py-8 text-center text-sm text-[#55556a]">
        Open source &middot; SOMA Studio &middot;{" "}
        <a
          href="https://somastudio.xyz"
          className="text-[#8b8b9e] hover:text-[#f0f0f3] transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          somastudio.xyz
        </a>
      </footer>
    </div>
  );
}
