function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'wclAuth' || action === 'wclQuery') {
    return handleWcl(e); // defined in wcl.gs
  }
  return handleProxy(e); // defined in proxy.gs
}
