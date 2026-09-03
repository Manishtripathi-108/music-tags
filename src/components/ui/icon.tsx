import { memo } from 'react';

import { type IconProps, Icon as Iconify } from '@iconify/react';

import IconSet from '@/constants/icons.constants';
import { cn } from './cn';
import { type T_IconType } from '@/types/client.types';

type Props = {
    icon: T_IconType;
    className?: string;
} & Omit<IconProps, 'icon' | 'className'>;

const Icon = ({ icon, className, ...props }: Props) => {
    return <Iconify data-component="icon" aria-hidden="true" icon={IconSet[icon]} className={cn('size-full', className)} {...props} />;
};

export default memo(Icon);
export { Icon };
