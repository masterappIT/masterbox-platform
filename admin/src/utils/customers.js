// Customers aren't stored on their own yet, so the list is worked out from the chat rooms.
export const customersFromRooms = (rooms, channels) => {
  const byCustomer = new Map()
  rooms.forEach((room) => {
    const channel = channels.find(({ account }) => account === room.channel_id)
    if (!channel) return
    const customer = (room.users || []).find((user) => user.id !== room.channel_id)
    if (!customer?.id) return
    const key = `${room.channel_id}:${customer.id}`
    const known = byCustomer.get(key)
    if (known && new Date(known.lastInteraction) >= new Date(room.updatedAt)) return
    byCustomer.set(key, {
      key,
      id: customer.id,
      name: `${customer.first_name || ''}${customer.last_name || ''}`.trim(),
      avatar: customer.avatar,
      platform: room.platform,
      channelId: room.channel_id,
      channelName: channel.name,
      roomId: room.chat_room_id,
      lastInteraction: room.updatedAt,
    })
  })
  return [...byCustomer.values()].sort((a, b) => new Date(b.lastInteraction) - new Date(a.lastInteraction))
}
