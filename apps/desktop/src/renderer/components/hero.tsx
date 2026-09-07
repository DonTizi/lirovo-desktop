import { motion } from "framer-motion";

/**
 * A quiet page title shared by Library, Schemas and Settings.
 *
 * Every primary surface opens with one, so a page is identifiable before its
 * content loads and the eye has somewhere to start. The line under it says
 * how the page is ordered and what never happens by itself — not what the
 * page is, which the title already said.
 */
export function Hero({
  title,
  sub,
}: {
  title: string;
  sub: string;
}): JSX.Element {
  return (
    <section className="relative pt-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="relative mx-auto mt-2 w-fit"
      >
        <h1 className="text-ink-strong text-center text-3xl font-normal tracking-tight">
          {title}
        </h1>
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.12 }}
        className="text-ink-label mt-3 text-center text-sm"
      >
        {sub}
      </motion.p>
    </section>
  );
}
