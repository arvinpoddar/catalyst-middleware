'use client';

import { Checkbox, Combobox, Group, List, Slot, Style } from '@makeswift/runtime/controls';
import { clsx } from 'clsx';
import { ReactNode } from 'react';
import useSWR from 'swr';

import { GetCustomerGroupResponse } from '~/client/queries/get-customer';
import { runtime } from '~/lib/makeswift/runtime';

import { CustomerGroupSchema, CustomerGroupsSchema, CustomerGroupsType } from './schema';

const NO_GROUP_ID = 'no-group';

async function getAllCustomerGroups(): Promise<CustomerGroupsType | undefined> {
  const response = await fetch('/api/customer/groups');

  const data: unknown = await response.json();
  const groups = CustomerGroupsSchema.parse(data);

  return groups;
}

async function fetchCustomerGroupData(): Promise<GetCustomerGroupResponse | undefined> {
  const response = await fetch('/api/customer/group');

  const data: unknown = await response.json();
  const group = CustomerGroupSchema.parse(data);

  return group;
}

function UntargetedGroup() {
  return (
    <div className="p-4 text-center text-lg text-gray-400">
      This group needs to be added to "Targeted customer groups".
    </div>
  );
}

interface Props {
  className: string;
  slots?: Array<{ group?: string; slot: ReactNode }>;
  simulateGroup: boolean;
  simulatedGroup?: string;
  noGroupSlot: ReactNode;
}

function CustomerGroupSlot({
  className,
  slots,
  simulateGroup,
  simulatedGroup = NO_GROUP_ID,
  noGroupSlot,
}: Props) {
  const allSlots = slots?.concat({ group: NO_GROUP_ID, slot: noGroupSlot });

  const { data, isLoading, error } = useSWR<GetCustomerGroupResponse | undefined, Error>(
    '/api/customer/group',
    fetchCustomerGroupData,
  );

  const customerGroupId = data?.customer?.customerGroupId;

  const simulatedSlot = allSlots?.find((s) => s.group === simulatedGroup)?.slot ?? (
    <UntargetedGroup />
  );
  const actualSlot = allSlots?.find((s) => s.group === `${customerGroupId}`)?.slot ?? (
    <UntargetedGroup />
  );

  // If we're simulating the group, render the selected group slot, otherwise use the group from the API. Coalesce to noGroupSlot if no group is found
  const groupSlot = simulateGroup ? simulatedSlot : actualSlot;
  const slot = !customerGroupId && !simulateGroup ? noGroupSlot : groupSlot;

  if (error)
    return (
      <p className={clsx(className, 'p-4 text-center text-gray-500')}>
        An error occurred trying to fetch the customer's group.
      </p>
    );

  if (isLoading) return <SlotSkeleton className={className} />;

  return <div className={className}>{slot}</div>;
}

export function SlotSkeleton({ className }: { className?: string }) {
  return (
    <div className={clsx(className, 'relative w-full animate-pulse p-2')}>
      <div className="line-clamp-1 h-20 w-full rounded-lg bg-contrast-100" />
    </div>
  );
}

runtime.registerComponent(CustomerGroupSlot, {
  type: 'catalyst-customer-group-slot',
  label: 'Catalyst / Customer Group Slot',
  props: {
    className: Style(),
    slots: List({
      label: 'Targeted customer groups',
      type: Group({
        label: 'Group',
        props: {
          group: Combobox({
            getOptions: async (query) => {
              try {
                const data = await getAllCustomerGroups();

                if (!data) return [];

                return data
                  .map((d) => ({
                    id: `${d.id}`,
                    label: d.name,
                    value: `${d.id}`,
                  }))
                  .filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));
              } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Error fetching customer group options:', error);

                return [];
              }
            },
          }),
          slot: Slot(),
        },
      }),
      getItemLabel(item) {
        return item?.group.label ?? 'Unselected group';
      },
    }),
    simulateGroup: Checkbox({ label: 'Simulate group', defaultValue: false }),
    simulatedGroup: Combobox({
      label: 'Simulated group',
      getOptions: async (query) => {
        try {
          const data = await getAllCustomerGroups();

          if (!data) return [];

          return data
            .map((d) => ({
              id: `${d.id}`,
              label: d.name,
              value: `${d.id}`,
            }))
            .filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Error fetching customer group options:', error);

          return [];
        }
      },
    }),
    noGroupSlot: Slot(),
  },
});
