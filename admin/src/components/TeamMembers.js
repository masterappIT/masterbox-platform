import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useRouter } from 'next/router'
import { useTranslation } from 'react-i18next'
import Avatar from '../stories/components/Avatar'
import { apolloApiHelpers } from '../graphQL'
import { LIST_ACCOUNTS } from '../graphQL/account'
import { selectUserInfo } from '../redux/slices/userSlices'

// The company's real accounts. Only admins may list them, so others don't see this section.
function TeamMembers() {
  const { t } = useTranslation()
  const companyId = useSelector(selectUserInfo)?.company_id
  // Re-read on navigation so the list follows changes made on the user pages.
  const { pathname } = useRouter()
  const [members, setMembers] = useState([])

  useEffect(() => {
    if (!companyId) return undefined
    let active = true
    apolloApiHelpers('query', LIST_ACCOUNTS, { input: { company_id: companyId } }, { fetchPolicy: 'no-cache' }).then((result) => {
      if (active) setMembers(result?.error ? [] : result?.items || [])
    })
    return () => { active = false }
  }, [companyId, pathname])

  if (!members.length) return null

  return (
    <section className='team-members' aria-label={t('team_members')}>
      <h2 className='team-members-title'>{t('team_members')}</h2>
      <ul className='team-members-list'>
        {members.map(({ _id, email, enabled, info }) => {
          const name = info?.name || email
          return (
            <li key={_id} className={`team-members-item ${enabled === false ? 'team-members-item-off' : ''}`} title={name}>
              <Avatar name={info?.avatar || name} size='mini' />
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default TeamMembers
