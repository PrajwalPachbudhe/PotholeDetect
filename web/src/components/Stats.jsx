import { motion } from 'framer-motion';

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1],
    },
  }),
};

export default function Stats({ detections, imageSize }) {
  const totalDetections = detections.length;
  const avgConfidence =
    totalDetections > 0
      ? Math.round(detections.reduce((sum, d) => sum + d.confidence, 0) / totalDetections)
      : 0;

  const uniqueClasses = [...new Set(detections.map((d) => d.class))].length;

  const stats = [
    {
      icon: '🎯',
      iconClass: 'blue',
      value: totalDetections,
      label: 'Detections Found',
    },
    {
      icon: '📊',
      iconClass: 'green',
      value: `${avgConfidence}%`,
      label: 'Avg Confidence',
    },
    {
      icon: '🏷️',
      iconClass: 'blue',
      value: uniqueClasses,
      label: 'Unique Classes',
    },
    {
      icon: '📐',
      iconClass: 'blue',
      value: imageSize ? `${imageSize.width}×${imageSize.height}` : '—',
      label: 'Image Resolution',
    },
  ];

  return (
    <div className="stats-grid">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          className="stat-card glass"
          custom={i}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
        >
          <div className={`stat-card-icon ${stat.iconClass}`}>{stat.icon}</div>
          <div className="stat-card-value">{stat.value}</div>
          <div className="stat-card-label">{stat.label}</div>
        </motion.div>
      ))}
    </div>
  );
}
