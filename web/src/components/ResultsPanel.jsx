import { motion } from 'framer-motion';
import Stats from './Stats';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
  },
};

export default function ResultsPanel({ results, onReset }) {
  if (!results) return null;

  const { original, annotated, detections, total_detections, image_size } = results;

  return (
    <motion.section
      className="results-section"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div className="results-header" variants={itemVariants}>
        <h2 className="results-title">
          ✅ Analysis Complete — {total_detections} detection{total_detections !== 1 ? 's' : ''}
        </h2>
        <div className="results-actions">
          <button className="btn-secondary" onClick={onReset}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            New Detection
          </button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={itemVariants}>
        <Stats detections={detections} imageSize={image_size} />
      </motion.div>

      {/* Image Comparison */}
      <motion.div className="image-comparison" variants={itemVariants}>
        <motion.div
          className="image-card"
          whileHover={{ scale: 1.01 }}
          transition={{ duration: 0.2 }}
        >
          <div className="image-card-header">
            <span className="dot dot-blue" />
            Original Image
          </div>
          <img src={`data:image/jpeg;base64,${original}`} alt="Original" />
        </motion.div>

        <motion.div
          className="image-card"
          whileHover={{ scale: 1.01 }}
          transition={{ duration: 0.2 }}
        >
          <div className="image-card-header">
            <span className="dot dot-green" />
            Detected Potholes
          </div>
          <img src={`data:image/jpeg;base64,${annotated}`} alt="Annotated" />
        </motion.div>
      </motion.div>

      {/* Detections List */}
      <motion.div className="detections-list" variants={itemVariants}>
        <div className="detections-list-header">
          🔍 Detection Details
        </div>

        {detections.length === 0 ? (
          <div className="no-detections">
            <div className="no-detections-icon">✨</div>
            <h3>No potholes detected</h3>
            <p>The road in this image appears to be in good condition.</p>
          </div>
        ) : (
          detections.map((det, i) => (
            <motion.div
              key={i}
              className="detection-item"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.08, duration: 0.4 }}
              whileHover={{ x: 4, transition: { duration: 0.15 } }}
            >
              <div className="detection-info">
                <div className="detection-icon">⚠️</div>
                <div>
                  <div className="detection-name">{det.class}</div>
                  <div className="detection-bbox">
                    bbox: ({det.bbox.x1}, {det.bbox.y1}) → ({det.bbox.x2}, {det.bbox.y2})
                  </div>
                </div>
              </div>
              <div className="detection-confidence">
                <div className="confidence-bar">
                  <motion.div
                    className="confidence-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${det.confidence}%` }}
                    transition={{ delay: 0.7 + i * 0.08, duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
                <div className="confidence-value">{det.confidence}%</div>
              </div>
            </motion.div>
          ))
        )}
      </motion.div>
    </motion.section>
  );
}
