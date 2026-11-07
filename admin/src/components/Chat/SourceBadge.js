import React from 'react'
import PropTypes from 'prop-types'
import { sourceLabel } from './capabilities'

// Spelled out in full so Tailwind keeps the classes.
const COLORS = {
  messenger: { soft: 'bg-source-messenger-soft', dot: 'bg-source-messenger' },
  instagram: { soft: 'bg-source-instagram-soft', dot: 'bg-source-instagram' },
  whatsapp_cloud: { soft: 'bg-source-whatsapp-cloud-soft', dot: 'bg-source-whatsapp-cloud' },
  whatsapp_web: { soft: 'bg-source-whatsapp-web-soft', dot: 'bg-source-whatsapp-web' },
  line: { soft: 'bg-source-line-soft', dot: 'bg-source-line' },
  masterbox: { soft: 'bg-source-chatbox-external-soft', dot: 'bg-source-chatbox-external' },
}

/** Where a conversation comes from: a dot and the source's name on its soft colour (Figma Admin/來源標記). */
function SourceBadge({ source, className }) {
  const label = sourceLabel(source)
  if (!label) return null
  const colors = COLORS[source]
  return (
    <span className={`inline-flex shrink-0 items-center gap-[5px] rounded-full px-[8px] py-[2px] ${colors.soft} ${className}`}>
      <span className={`size-[6px] shrink-0 rounded-full ${colors.dot}`} aria-hidden='true' />
      <span className='whitespace-nowrap text-[12px] font-medium leading-[1.4] text-text-primary'>{label}</span>
    </span>
  )
}

SourceBadge.propTypes = {
  // messenger, instagram, whatsapp_cloud, whatsapp_web, line or masterbox; nothing shows for an unknown one
  source: PropTypes.string,
  className: PropTypes.string,
}

SourceBadge.defaultProps = {
  source: null,
  className: '',
}

export default SourceBadge
