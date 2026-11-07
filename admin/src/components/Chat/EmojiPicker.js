import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'

// Common emoji, grouped the way phone keyboards group them. Plain characters, so every platform shows them.
const GROUPS = [
  { name: '表情', emoji: '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😜 🤪 😝 🤗 🤭 🤫 🤔 🤐 😐 😑 😶 😏 😒 🙄 😬 😮‍💨 😔 😪 😴 😷 🤒 🤧 🥵 🥶 😵 🤯 🥳 😎 🤓 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 😤 😡 😠' },
  { name: '手勢', emoji: '👍 👎 👌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💪 🫶 🙇 🙋 🤷 🤦 🙆 🙅' },
  { name: '愛心', emoji: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 ✨ ⭐ 🌟 💯 ✅ ☑️ ✔️ ❌ ❗ ❓ ⚠️ 🔥 💥 🎉 🎊 🎈 🎁 🏆 🥇' },
  { name: '生活', emoji: '☕ 🍵 🧋 🍰 🎂 🍪 🍜 🍱 🍣 🍕 🍔 🍟 🍎 🍊 🍓 🌹 🌸 🌻 🌈 ☀️ 🌙 ⛅ ☔ ❄️ 🎄 🧧 🏮 🚗 ✈️ 🏠 🏢 📱 💻 📷 📦 📮 ✉️ 📞 💰 💳 🧾 📅 ⏰ 📍 🔔 🛒 🎵' },
].map(group => ({ ...group, emoji: group.emoji.split(' ') }))

/**
 * 表情選擇器，選了之後交給 onSelect，可以連續選多個
 * @param onSelect (emoji: string) => void
 * @param onClose () => void - 點到外面或按 Esc 時呼叫
 */
function EmojiPicker({ onSelect, onClose }) {
  const [groupIndex, setGroupIndex] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    const handlePointer = (event) => {
      if (ref.current && !ref.current.contains(event.target) && !event.target.closest?.('[data-emoji-toggle]')) onClose()
    }
    const handleKey = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  return (
    // Clicking anywhere in the picker keeps the text box focused, with its cursor where it was.
    <div ref={ref} className='messenger-emojiPicker' role='dialog' aria-label='選擇表情' onMouseDown={(event) => event.preventDefault()}>
      <div className='messenger-emojiPicker-tabs' role='tablist'>
        {GROUPS.map(({ name }, i) => (
          <button key={name} type='button' role='tab' aria-selected={i === groupIndex}
            className={`messenger-emojiPicker-tab ${i === groupIndex ? 'is-active' : ''}`}
            onClick={() => setGroupIndex(i)}>{name}</button>
        ))}
      </div>
      <div className='messenger-emojiPicker-grid'>
        {GROUPS[groupIndex].emoji.map(emoji => (
          <button key={emoji} type='button' className='messenger-emojiPicker-emoji' aria-label={emoji}
            onClick={() => onSelect(emoji)}>{emoji}</button>
        ))}
      </div>
    </div>
  )
}

EmojiPicker.propTypes = {
  onSelect: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
}

export default EmojiPicker
