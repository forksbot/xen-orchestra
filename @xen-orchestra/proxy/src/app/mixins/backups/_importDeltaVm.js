import defer from 'golike-defer'
import groupBy from 'lodash/groupBy'
import ignoreErrors from 'promise-toolbox/ignoreErrors'

export const importDeltaVm = defer(
  async ($defer, { vbdRecords, vdiRecords, vdiStreams, vmRecord, xapi }) => {
    const vmRef = await xapi.$call('VM.create', {
      ...vmRecord,
      affinity: null,
      blocked_operations: {
        ...vmRecord.blocked_operations,
        start: 'Importing…',
      },
      ha_always_run: false,
      is_a_template: false,
      name_label: '[Importing…] ' + vmRecord.name_label,
      // other_config: {
      //   ...vmRecord.other_config,
      //   [TAG_COPY_SRC]: vmRecord.uuid,
      // },
    })
    $defer.onFailure.call(xapi, 'VM_destroy', vmRef)

    // 2. Delete all VBDs which may have been created by the import.
    await Promise.all(
      (await xapi.getField('VM', vmRef, 'VBDs')).map(ref =>
        ignoreErrors.call(xapi.call('VBD.destroy', ref))
      )
    )

    // 3. Create VDIs & VBDs.
    const vbds = groupBy(vbdRecords, 'VDI')
    const newVdis = {}
    await Promise.all(
      Object.keys(vdiRecords).map(async vdiId => {
        const vdi = vdiRecords[vdiId]
        let newVdi

        const remoteBaseVdiUuid = detectBase && vdi.other_config[TAG_BASE_DELTA]
        if (remoteBaseVdiUuid) {
          const baseVdi = find(
            baseVdis,
            vdi => vdi.other_config[TAG_COPY_SRC] === remoteBaseVdiUuid
          )
          if (!baseVdi) {
            throw new Error(`missing base VDI (copy of ${remoteBaseVdiUuid})`)
          }

          newVdi = await this._getOrWaitObject(await this._cloneVdi(baseVdi))
          $defer.onFailure(() => this._deleteVdi(newVdi.$ref))

          await newVdi.update_other_config(TAG_COPY_SRC, vdi.uuid)
        } else {
          newVdi = await this.createVdi({
            ...vdi,
            other_config: {
              ...vdi.other_config,
              [TAG_BASE_DELTA]: undefined,
              [TAG_COPY_SRC]: vdi.uuid,
            },
            sr: mapVdisSrs[vdi.uuid] || srId,
          })
          $defer.onFailure(() => this._deleteVdi(newVdi.$ref))
        }

        await asyncMap(vbds[vdiId], vbd =>
          this.createVbd({
            ...vbd,
            vdi: newVdi,
            vm,
          })
        )

        newVdis[id] = newVdi
      })
    )

    const networksByNameLabelByVlan = {}
    let defaultNetwork
    forEach(this.objects.all, object => {
      if (object.$type === 'network') {
        const pif = object.$PIFs[0]
        if (pif === undefined) {
          // ignore network
          return
        }
        const vlan = pif.VLAN
        const networksByNameLabel =
          networksByNameLabelByVlan[vlan] ||
          (networksByNameLabelByVlan[vlan] = {})
        defaultNetwork = networksByNameLabel[object.name_label] = object
      }
    })

    const { streams } = delta
    let transferSize = 0

    await Promise.all([
      // Import VDI contents.
      asyncMap(newVdis, async (vdi, id) => {
        for (let stream of ensureArray(streams[`${id}.vhd`])) {
          if (typeof stream === 'function') {
            stream = await stream()
          }
          const sizeStream = stream
            .pipe(createSizeStream())
            .once('finish', () => {
              transferSize += sizeStream.size
            })
          sizeStream.task = stream.task
          sizeStream.length = stream.length
          await this._importVdiContent(vdi, sizeStream, VDI_FORMAT_VHD)
        }
      }),

      // Wait for VDI export tasks (if any) termination.
      asyncMap(streams, stream => stream.task),

      // Create VIFs.
      asyncMap(delta.vifs, vif => {
        let network =
          vif.$network$uuid && this.getObject(vif.$network$uuid, undefined)

        if (network === undefined) {
          const { $network$VLAN: vlan = -1 } = vif
          const networksByNameLabel = networksByNameLabelByVlan[vlan]
          if (networksByNameLabel !== undefined) {
            network = networksByNameLabel[vif.$network$name_label]
            if (network === undefined) {
              network = networksByNameLabel[Object.keys(networksByNameLabel)[0]]
            }
          } else {
            network = defaultNetwork
          }
        }

        if (network) {
          return this._createVif(vm, network, vif)
        }
      }),
    ])

    if (deleteBase && baseVm) {
      this._deleteVm(baseVm)::ignoreErrors()
    }

    await Promise.all([
      delta.vm.ha_always_run && vm.set_ha_always_run(true),
      vm.set_name_label(name_label),
      // FIXME: move
      vm.update_blocked_operations(
        'start',
        disableStartAfterImport
          ? 'Do not start this VM, clone it if you want to use it.'
          : null
      ),
    ])

    return { transferSize, vm }
  }
)
