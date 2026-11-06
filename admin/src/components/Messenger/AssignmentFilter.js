import React from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'

const AGENT = 'agent:'

/** The list filter for a value of this select: everyone's, the agent's own, nobody's, or one colleague's conversations. */
export const assignmentFilter = (value, myId) => {
  if (value === 'mine') return myId ? { assignee_id: myId } : {}
  if (value === 'unassigned') return { assignment: 'unassigned' }
  if (value?.startsWith(AGENT)) return { assignee_id: value.slice(AGENT.length) }
  return {}
}

/** Picks whose conversations the list shows. */
function AssignmentFilter({ value, onChange, agents, myId, className }) {
  const { t } = useTranslation()
  const colleagues = agents.filter(({ id }) => id !== myId)
  return (
    <select className={className} value={value} aria-label={t('assignment_filter')} onChange={(event) => onChange(event.target.value)}>
      <option value=''>{t('assignment_all')}</option>
      <option value='mine'>{t('assignment_mine')}</option>
      <option value='unassigned'>{t('assignment_unassigned')}</option>
      {colleagues.length > 0 && (
        <optgroup label={t('assignment_by_agent')}>
          {colleagues.map(({ id, name }) => <option key={id} value={`${AGENT}${id}`}>{name}</option>)}
        </optgroup>
      )}
    </select>
  )
}

AssignmentFilter.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  agents: PropTypes.array,
  myId: PropTypes.string,
  className: PropTypes.string,
}

AssignmentFilter.defaultProps = {
  agents: [],
  myId: null,
  className: 'messenger-list-filters-platform',
}

export default AssignmentFilter
