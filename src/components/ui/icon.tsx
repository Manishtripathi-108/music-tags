import { memo } from 'react';

import { type IconProps, Icon as Iconify } from '@iconify/react';

import IconSet from '@/constants/icons.constants';
import { type T_IconType } from '@/lib/types/client.types';
import cn from '@/lib/utils/cn';

type Props = {
    icon: T_IconType;
    className?: string;
} & Omit<IconProps, 'icon' | 'className'>;

const Icon = ({ icon, className, ...props }: Props) => {
    return <Iconify data-component="icon" aria-hidden="true" icon={IconSet[icon]} className={cn('size-full', className)} {...props} />;
};

export default memo(Icon);
export { Icon };
