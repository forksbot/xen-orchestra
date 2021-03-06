# Job manager

> Job manager is available in XOA 4.10 and higher

The key idea is to be able to schedule any action (migrate, reboot etc.), for things like backups, snapshots or DR actions.

In the main menu, go to the "Job Manager" section:

![](./assets/jobmanager.png)

You can now **schedule all actions** on your hosts, VMs, or ACLs. It's configured in 2 steps:

1. Create a job
1. Schedule it!

Real example, step by step: **Creating a job called "security reboot"** (in this case, restarting "nfs" and "Core1" VMs):

![](./assets/job_create.png)

Note that you can execute this job **now** by clicking on the orange play button (to test it for instance):

![](./assets/job_execute.png)

**Schedule the job** (every Sunday at 5:00 AM):

![](./assets/schedule_job.png)

And that's it! The job is listed in the Overview:

![](./assets/schedule_recap.png)

The possibilities are infinite! You can schedule a **lot** of things (any actions on a VM, like migrate, start, clone, suspend etc. Same thing also applies to hosts).

## Examples

### Save on your electric bill

- plan a live migration of your VMs at 11:00PM to a less powerful host, then shutdown the big one
- start the big server at 6:00AM and migrate the VMs back 15 minutes later

### Scale when needed

- schedule the boot of extra VMs during your usual activity spikes (horizontal scaling)
- also add more vCPUs or RAM to these VMs at the same time
- go back to the previous state when your planned load is low (e.g: during the night)

### Planned reboot

- For example: your client app is not very stable, or you need to reboot every month after kernel updates: schedule this during the weekend!

### Add or Remove ACLs

- revoke your user ACLs Friday at 11:00PM (e.g: no access on the weekend)
- restore them Monday at 6:00AM
