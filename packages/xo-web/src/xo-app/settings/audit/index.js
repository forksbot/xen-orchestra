import _, { messages } from 'intl'
import ActionButton from 'action-button'
import addSubscriptions from 'add-subscriptions'
import Copiable from 'copiable'
import CopyToClipboard from 'react-copy-to-clipboard'
import decorate from 'apply-decorators'
import defined from '@xen-orchestra/defined'
import Icon from 'icon'
import Link from 'link'
import NoObjects from 'no-objects'
import React from 'react'
import SortedTable from 'sorted-table'
import Tooltip from 'tooltip'
import { alert, chooseAction, form } from 'modal'
import { alteredAuditRecord, missingAuditRecord } from 'xo-common/api-errors'
import { FormattedDate, injectIntl } from 'react-intl'
import { error } from 'notification'
import {
  checkAuditRecordsIntegrity,
  generateNewAuditHash,
  subscribeAuditRecords,
} from 'xo'

const HashDisplay = ({ hash, text = hash.slice(4, 8) }) => (
  <Tooltip content={_('copyToClipboard')}>
    <CopyToClipboard text={hash}>
      <span style={{ cursor: 'pointer' }}>{text}</span>
    </CopyToClipboard>
  </Tooltip>
)

const displayRecord = record =>
  alert(
    <span>
      <Icon icon='audit' /> {_('auditRecord')}
    </span>,
    <Copiable tagName='pre'>{JSON.stringify(record, null, 2)}</Copiable>
  )

const INDIVIDUAL_ACTIONS = [
  {
    handler: displayRecord,
    icon: 'preview',
    label: _('displayAuditRecord'),
  },
]

const DEFAULT_HASH = 'nullId|nullId'

const openHashPromptModal = formatMessage =>
  form({
    render: ({ onChange, value }) => (
      <div className='form-group'>
        <input
          className='form-control'
          onChange={onChange}
          placeholder={formatMessage(messages.auditPutSavedTrustyHash)}
          pattern='[^|]+\|[^|]+'
          value={value}
        />
      </div>
    ),
    header: (
      <span>
        <Icon icon='diagnosis' /> {_('checkIntegrity')}
      </span>
    ),
  }).then((value = '') => {
    value = value.trim()
    return (value !== '' ? value : DEFAULT_HASH).split('|')
  })

const getIntegrityFeedbackRender = result => {
  if (typeof result === 'number') {
    return (
      <span className='text-success'>
        {_('auditRecordsIntegrityValid', { n: result })} <Icon icon='success' />
      </span>
    )
  }
  if (missingAuditRecord.is(result)) {
    const { id, nValid } = result.data
    return (
      <span className='text-danger'>
        <Icon icon='alarm' />{' '}
        {_('auditMissingRecord', {
          id: <HashDisplay hash={id} />,
          n: nValid,
        })}
      </span>
    )
  }
  if (alteredAuditRecord.is(result)) {
    const { id, nValid } = result.data
    return (
      <span className='text-danger'>
        <Icon icon='alarm' />{' '}
        {_('auditAlteredRecord', {
          id: <HashDisplay hash={id} />,
          n: nValid,
        })}
      </span>
    )
  }
  error(
    _('auditIntegrityCheckErrorTitle'),
    _('auditIntegrityCheckErrorMessage')
  )
}

const openIntegrityFeedbackModal = result => {
  const body = getIntegrityFeedbackRender(result)
  return body !== undefined
    ? chooseAction({
        icon: 'diagnosis',
        title: _('checkIntegrity'),
        body,
        buttons: [
          {
            btnStyle: 'success',
            label: _('auditGenerateNewHash'),
          },
        ],
      }).then(
        () => defined(() => result.data.id, true),
        () => false
      )
    : false
}

const openCoherenceFeedbackModal = (result, hash) => {
  const feedback = getIntegrityFeedbackRender(result)
  if (feedback !== undefined) {
    alert(
      <span>
        <Icon icon='diagnosis' /> {_('auditCheckCoherence')}
      </span>,
      <div>
        <p>{feedback}</p>
        <p>
          <HashDisplay hash={hash} text={_('auditClickToCopyNewHash')} />
        </p>
        <span className='text-muted'>
          <Icon icon='info' /> {_('auditSaveTrustyHash')}
        </span>
      </div>
    )
  }
}

const _checkIntegrity = async formatMessage => {
  const [oldest, newest] = await openHashPromptModal(formatMessage)
  const integrityResult = await checkAuditRecordsIntegrity(
    oldest,
    newest
  ).catch(error => error)
  const feedBackResult = await openIntegrityFeedbackModal(integrityResult)
  if (feedBackResult) {
    const { result, hash } = await generateNewAuditHash(newest)
    openCoherenceFeedbackModal(
      result,
      typeof feedBackResult === 'string'
        ? `${feedBackResult}|${result.split('|')[1]}`
        : hash
    )
  }
}

const COLUMNS = [
  {
    itemRenderer: ({ subject: { userName } }) => (
      <Link to={`/settings/users?s=email:/^${userName}$/`}>{userName}</Link>
    ),
    name: _('user'),
    sortCriteria: 'subject.userName',
  },
  {
    name: _('ip'),
    valuePath: 'subject.userIp',
  },
  {
    itemRenderer: ({ data, event }) =>
      event === 'apiCall' ? data.method : event,
    name: _('auditActionEvent'),
    sortCriteria: ({ data, event }) =>
      event === 'apiCall' ? data.method : event,
  },
  {
    itemRenderer: ({ time }) => (
      <FormattedDate
        day='numeric'
        hour='2-digit'
        minute='2-digit'
        month='short'
        second='2-digit'
        value={new Date(time)}
        year='numeric'
      />
    ),
    name: _('date'),
    sortCriteria: 'time',
    sortOrder: 'desc',
  },
]

export default decorate([
  addSubscriptions({
    records: subscribeAuditRecords,
  }),
  injectIntl,
  ({ records, intl: { formatMessage } }) => (
    <div>
      <div className='mt-1 mb-1'>
        <ActionButton
          btnStyle='success'
          handler={_checkIntegrity}
          handlerParam={formatMessage}
          icon='diagnosis'
          size='large'
        >
          {_('checkIntegrity')}
        </ActionButton>
      </div>
      <NoObjects
        collection={records}
        columns={COLUMNS}
        component={SortedTable}
        defaultColumn={3}
        emptyMessage={
          <span className='text-muted'>
            <Icon icon='alarm' />
            &nbsp;
            {_('noAuditRecordAvailable')}
          </span>
        }
        individualActions={INDIVIDUAL_ACTIONS}
        stateUrlParam='s'
      />
    </div>
  ),
])
