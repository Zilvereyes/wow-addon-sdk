/** Secondary import graph audit; offline node-based boundary audit also runs in CI. */
const permitted = {
  diagnostics: ['diagnostics'],
  'addon-metadata': ['addon-metadata', 'diagnostics'],
  'toc-parser': ['toc-parser', 'diagnostics', 'addon-metadata'],
  'global-registry': ['global-registry', 'diagnostics'],
  'toc-metadata-adapter': ['toc-metadata-adapter', 'diagnostics','addon-metadata','global-registry'],
};
module.exports = {
  forbidden: [
    { name:'no-circular',severity:'error',from:{},to:{circular:true} },
    { name:'no-unresolved',severity:'error',from:{},to:{couldNotResolve:true} },
    ...Object.entries(permitted).map(([pkg, to]) => ({
      name:`boundary-${pkg}`, severity:'error',
      from:{path:`^packages/${pkg}/src/`},
      to:{path:'^packages/',pathNot:`^packages/(${to.join('|')})/`},
    })),
  ],
  options:{
    tsPreCompilationDeps:true,
    enhancedResolveOptions:{extensions:['.ts','.js','.json','.d.ts']},
    exclude:{path:'(^|/)node_modules/'},
  },
};
