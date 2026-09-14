function formatDuration(seconds) {
  if (typeof seconds !== 'number' || Number.isNaN(seconds)) return '--:--';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export default function MediaItem({ asset, onAddToTimeline }) {
  return (
    <li className="media-item">
      <div className="media-item-info">
        <span className={`badge badge-${asset.type}`}>{asset.type}</span>
        <span className="media-item-name" title={asset.name}>
          {asset.name}
        </span>
        <span className="media-item-duration">{formatDuration(asset.duration)}</span>
      </div>
      <button onClick={() => onAddToTimeline(asset)}>Add to Timeline</button>
    </li>
  );
}
