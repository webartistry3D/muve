import React from 'react';
import { motion } from 'framer-motion';

const BASE = import.meta.env.BASE_URL;

export default function Hero() {
  return (
    <section className="hero" id="top">
      <motion.picture
        className="hero__bg-wrap"
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
      >
        <source media="(max-width: 860px)" srcSet={`${BASE}assets/01-city-m.webp`} />
        <img className="hero__bg" src={`${BASE}assets/01-city.webp`} alt="Lagos" />
      </motion.picture>
      <div className="hero__overlay"></div>
      <div className="hero__content">
        {/*<span className="hero__eyebrow">A city in motion</span>*/}
        <motion.h2
          className="hero__title"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          Every journey starts with a Muve..
        </motion.h2>
        {/*<p className="hero__body">
          From the first light of dawn over the lagoon to the last danfo bus rolling home — this is a city that never stops moving.
        </p>*/}
        <motion.div
          className="hero__tags"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <span>Real-time</span>
          <span>Live GPS</span>
          {/*<span>Road-routing</span>*/}
        </motion.div>
        <motion.a
          href="/app"
          className="hero__cta"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          Ride now &rarr;
        </motion.a>
      </div>
    </section>
  );
}
