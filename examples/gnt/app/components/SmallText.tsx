import { type FunctionComponent, type PropsWithChildren } from 'react';
import Skeleton from './Skeleton';

const SmallText: FunctionComponent<
  PropsWithChildren<{ textLength?: number }>
> = ({ textLength = 25, children }) => (
  <p className="text-xs text-gray-500 dark:text-gray-400">
    <Skeleton
      fallback={
        <span
          className={`
          inline-block
          animate-pulse
          bg-gray-400
          leading-none
          max-w-[${textLength}ch]
          max-w-prose
          min-w-10
          w-full
          rounded-full
        `}
        >
          &nbsp;
        </span>
      }
    >
      {children}
    </Skeleton>
  </p>
);

export default SmallText;
