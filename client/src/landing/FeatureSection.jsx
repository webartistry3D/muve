import React from 'react';
import { motion } from 'framer-motion';

const BASE = import.meta.env.BASE_URL;

const ease = [0.16, 1, 0.3, 1];

export default function FeatureSection({ num, eyebrow, eyebrowColor, title, body, tags = [], cta, image, reverse, textRight }) {
  return (
    <section className={`feature${reverse ? ' feature--reverse' : ''}${textRight ? ' feature--text-right' : ''}`}>
      <div className="feature__text">
        {num && (
          <motion.div
            className="feature__num"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, ease }}
          >
            {num}
          </motion.div>
        )}
        {eyebrow && (
          <motion.span
            className="feature__eyebrow"
            style={{ color: eyebrowColor }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, delay: 0.1, ease }}
          >
            {eyebrow}
          </motion.span>
        )}
        <motion.h2
          className="feature__title"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, delay: 0.15, ease }}
        >
          {title}
        </motion.h2>
        <motion.p
          className="feature__body"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, delay: 0.25, ease }}
        >
          {body}
        </motion.p>
        {tags.length > 0 && (
          <motion.div
            className="feature__tags"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, delay: 0.35, ease }}
          >
            {tags.map((t) => <span key={t}>{t}</span>)}
          </motion.div>
        )}
        {cta && (
          <motion.a
            href="/app"
            className="feature__cta"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, delay: 0.45, ease }}
          >
            {cta} <span className="arrow">&rarr;</span>
          </motion.a>
        )}
      </div>
      <motion.div
        className="feature__image"
        initial={{ opacity: 0, y: 60 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 1.4, delay: 0.3, ease }}
      >
        <img src={`${BASE}assets/${image}`} alt="" loading="lazy" />
      </motion.div>
    </section>
  );
}
