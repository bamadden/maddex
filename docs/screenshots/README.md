# Marketing screenshots

These are hero images for the site and store listings. They live here rather
than in `public/` deliberately: Vite copies `public/` into `dist/` verbatim,
so a 387KB PNG that no code references was being shipped to every visitor on
every deploy and never requested by anything.

Nothing in `src/` imports these. If one ever needs to render inside the app,
import it from `src/assets/` instead so the bundler can hash, compress and
tree-shake it.
