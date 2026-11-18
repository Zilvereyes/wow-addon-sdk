/** API call receipts shared by the worker and its parent validator. */
export const graphApis = Object.freeze(['parseToc', 'parseXml', 'analyzeLua', 'analyzeXml', 'mapXmlValueRanges']);
export const emptyGraphCalls = () => Object.fromEntries(graphApis.map(name => [name, {invoked: 0, returned: 0}]));
