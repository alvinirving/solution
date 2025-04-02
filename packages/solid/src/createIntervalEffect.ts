import { onCleanup, onMount } from 'solid-js';
import type { ArrowFunction } from '.';

export var createIntervalEffect = <TCallback extends ArrowFunction>(
  fn: TCallback,
  interval: number,
  getArguments?: () => Parameters<TCallback>
) => {
  let intervalId: number | NodeJS.Timeout;

  onMount(() => {
    if (intervalId) return;

    intervalId = setInterval(() => {
      var args = getArguments?.() ?? [];
      fn(...args);
    }, interval);
  });

  onCleanup(() => {
    clearInterval(intervalId);
  });
};
