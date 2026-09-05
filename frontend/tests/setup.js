import { config } from '@vue/test-utils';

config.global.stubs = {
  ...config.global.stubs,
  'scroll-view': {
    name: 'UniScrollViewStub',
    template: '<div data-uni-test-element="scroll-view"><slot /></div>',
  },
};
