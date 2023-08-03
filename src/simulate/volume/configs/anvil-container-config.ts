import { ANVIL_IMAGE_NAME } from '../../../env';

export const anvilContainerConfig = (jsonRpcUrl: string, name: string) => ({
    ['Image']: ANVIL_IMAGE_NAME,
    ['Cmd']: [`anvil -f ${jsonRpcUrl} --host 0.0.0.0`],
    ['HostConfig']: {
        ['PortBindings']: {
            ['8545/tcp']: [{ ['HostPort']: '8545' }],
        },
    },
    ['ExposedPorts']: {
        ['8545/tcp']: {},
    },
    name,
});
