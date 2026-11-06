import React, { useState } from 'react'
import PropTypes from 'prop-types'
import Avatar from '../../stories/components/Avatar'
import Headline from '../../stories/components/Headline'
import ContentText from '../../stories/components/ContentText'
import Icon from '../../stories/components/Icon'
import { useTranslation } from 'react-i18next'
import { dateTimeLabel } from '../../utils/messageTime'
import { customerOfRoom } from './ChatroomList'

const TAG_MAX_LENGTH = 20

/**
 * What we know about the customer of a conversation, from the platform, and the company's tags for them.
 * Anything the platform doesn't share is left out rather than guessed.
 */
function CustomerPanel({ room, isShown, onClose, tagSuggestions, onAddTag, onRemoveTag }) {
  const { t, i18n } = useTranslation()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  if (!room) return <div className='messenger-sideInfo messenger-sideInfo-hidden' aria-hidden='true' />

  const customer = { ...customerOfRoom(room), ...(room.customer || {}) }
  const language = i18n.language
  const rows = [
    [t('customer_platform'), room.platform ? t(`platform_${room.platform}`) : null],
    [t('customer_channel'), room.channel_name],
    [t('customer_username'), customer.username ? `@${customer.username}` : null],
    [t('customer_phone'), customer.phone],
    // WhatsApp's id is the phone number, already shown above.
    [t('customer_platform_id'), room.platform === 'whatsapp' ? null : customer.id],
    [t('conversation_started'), dateTimeLabel(room.createdAt, { language })],
    [t('last_message_at'), dateTimeLabel(room.lastMessageAt, { language })],
  ].filter(([, value]) => value)

  const tags = room.tags || []
  const suggestions = tagSuggestions.filter(({ name }) => !tags.some((tag) => tag.name === name))

  const save = async (action) => {
    setSaving(true)
    setError(null)
    try {
      await action()
      return true
    } catch (reason) {
      setError(t('tag_save_failed', { reason: typeof reason === 'string' ? reason : reason?.message || '' }))
      return false
    } finally {
      setSaving(false)
    }
  }

  const addTag = async (event) => {
    event.preventDefault()
    const name = draft.trim()
    if (!name || saving) return
    if (await save(() => onAddTag(name))) setDraft('')
  }

  return (
    <aside className={`messenger-sideInfo ${isShown ? '' : 'messenger-sideInfo-hidden'}`} aria-label={t('customer_info')} aria-hidden={!isShown}>
      <Icon name='closeBtn' onClick={onClose} customStyles='self-end m-[10px] cursor-pointer shrink-0' />
      <div className='messenger-customer'>
        <Avatar size='large' name={customer.avatar || customer.name} />
        <Headline size='normal' title={customer.name || t('no_name')} customStyles='mt-[12px] text-center break-all' />
        <dl className='messenger-customer-rows'>
          {rows.map(([label, value]) => (
            <div key={label} className='messenger-customer-row'>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className='messenger-customer-tags'>
        <Headline size='small' title={t('customer_tags')} color='black-primary' />
        <div className='messenger-customer-tags-list'>
          {tags.length ? tags.map((tag) => (
            <span key={tag.id} className='messenger-customer-tag'>
              {tag.name}
              <button type='button' aria-label={t('remove_tag', { name: tag.name })} disabled={saving} onClick={() => save(() => onRemoveTag(tag.id))}>×</button>
            </span>
          )) : <ContentText title={t('no_customer_tags')} size='small' color='black-tertiary' />}
        </div>
        <form onSubmit={addTag}>
          <input
            className='messenger-customer-tags-input'
            value={draft}
            maxLength={TAG_MAX_LENGTH}
            placeholder={t('add_customer_tag')}
            aria-label={t('add_customer_tag')}
            list={`customer-tags-${room.id}`}
            disabled={saving}
            onChange={(event) => setDraft(event.target.value)}
          />
          <datalist id={`customer-tags-${room.id}`}>
            {suggestions.map(({ id, name }) => <option key={id} value={name} />)}
          </datalist>
        </form>
        {error && <ContentText title={error} size='small' color='alert' customStyles='mt-[6px]' />}
      </div>
    </aside>
  )
}

CustomerPanel.propTypes = {
  room: PropTypes.object,
  isShown: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  tagSuggestions: PropTypes.array,
  // Each returns a promise that rejects with the reason when it didn't save.
  onAddTag: PropTypes.func.isRequired,
  onRemoveTag: PropTypes.func.isRequired,
}

CustomerPanel.defaultProps = {
  room: null,
  isShown: false,
  tagSuggestions: [],
}

export default CustomerPanel
