import config from '../../resources/distribution.json';

export const GITHUB_REPOSITORY = `${config.owner}/${config.repo}`;
export const SHARED_DATA_URL = `https://github.com/${GITHUB_REPOSITORY}/releases/download/${config.dataTag}/manifest.json`;
