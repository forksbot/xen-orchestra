import _ from 'intl'
import addSubscriptions from 'add-subscriptions'
import Button from 'button'
import Copiable from 'copiable'
import decorate from 'apply-decorators'
import Icon from 'icon'
import NoObjects from 'no-objects'
import React from 'react'
import SortedTable from 'sorted-table'
import { FormattedDate } from 'react-intl'
import { provideState, injectState } from 'reaclette'
import { subscribeAuditRecords } from 'xo'
import { toggleState } from 'reaclette-utils'

const ToggleItem = decorate([
  provideState({
    initialState: () => ({
      displayed: false,
    }),
    effects: {
      toggleState,
    },
  }),
  injectState,
  ({ state, effects, children }) => (
    <span>
      <Button name='displayed' onClick={effects.toggleState} size='small'>
        <Icon icon={state.displayed ? 'minus' : 'plus'} />
      </Button>
      <div>{state.displayed && children}</div>
    </span>
  ),
])

const COLUMNS = [
  {
    itemRenderer: ({ id }) => (
      <Copiable data={id} tagName='p'>
        {id.slice(4, 8)}
      </Copiable>
    ),
    name: _('hash'),
  },
  {
    itemRenderer: ({ userId, userName, userIp }) => (
      <Copiable data={userId} tagName='p'>
        {userName} ({userIp})
      </Copiable>
    ),
    name: _('user'),
    sortCriteria: 'userName',
  },
  {
    name: _('auditActionEvent'),
    valuePath: 'event',
  },
  {
    itemRenderer: ({ timestamp }) => (
      <FormattedDate
        value={new Date(timestamp)}
        month='short'
        day='numeric'
        year='numeric'
        hour='2-digit'
        minute='2-digit'
        second='2-digit'
      />
    ),
    name: _('date'),
    sortCriteria: 'timestamp',
    sortOrder: 'desc',
  },
  {
    itemRenderer: ({ data = {} }) => (
      <ul>
        {Object.keys(data).map(key => {
          let value = data[key]

          const type = typeof value
          if (type === 'object') {
            value = (
              <ToggleItem>
                <pre>{JSON.stringify(value, null, 2)}</pre>
              </ToggleItem>
            )
          }

          if (type === 'boolean') {
            value = String(value)
          }

          return (
            <li key={key} className='mb-1'>
              {_.keyValue(key, value)}
            </li>
          )
        })}
      </ul>
    ),
    name: _('data'),
  },
]

export default decorate([
  addSubscriptions({
    records: subscribeAuditRecords,
  }),
  provideState({
    computed: {
      data: (_, { records }) =>
        records &&
        records.map(
          ({
            id,
            subject,
            event,
            data: { timestamp, method, callId, duration, ...data },
          }) => ({
            data,
            event: event === 'apiCall' ? method : event,
            id,
            timestamp,
            ...subject,
          })
        ),
    },
  }),
  injectState,
  ({ state }) => (
    <div>
      <NoObjects
        collection={state.data}
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
        stateUrlParam='s'
      />
    </div>
  ),
])
