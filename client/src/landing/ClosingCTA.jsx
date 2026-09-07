import React from 'react';
import { motion } from 'framer-motion';

const ease = [0.16, 1, 0.3, 1];

export default function ClosingCTA() {
  return (
    <section className="closing">
      <motion.span
        className="closing__eyebrow"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5, ease }}
      >
        Built for Nigeria
      </motion.span>
      <motion.h2
        className="closing__title"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.7, delay: 0.1, ease }}
      >
        Get there. With <span className="highlight-green">Muve.</span>
      </motion.h2>
      <motion.p
        className="closing__body"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, delay: 0.2, ease }}
      >
        A ride-hailing platform built for Nigeria.
      </motion.p>
      <motion.div
        className="closing__btns"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5, delay: 0.3, ease }}
      >
        <a href="/app" className="primary">Ride now</a>
        {/* <a href="https://github.com/webartistry3D/muve" className="secondary">View on GitHub</a> */}
      </motion.div>
    </section>
  );
}
