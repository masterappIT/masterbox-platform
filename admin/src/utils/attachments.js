// Meta sends a Messenger sticker, such as the Like button, as an image and a sticker with the same sticker_id.
export const withoutRepeatedStickers = (attachments) => {
  const seen = new Set();
  return attachments?.filter((attachment) => {
    const id = attachment?.payload?.sticker_id;
    if (id == null) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

export const isSticker = ({ type, payload }) => type === 'sticker' || payload?.sticker_id != null;
