(function(root){
  'use strict';

  const STORAGE_KEY = 'qc_case_sessions';
  const TTL_MS = 10 * 60 * 1000;

  function getStorage(){
    try { return root.localStorage || null; } catch(e) { return null; }
  }

  function normalizeCaseName(value){
    return String(value === null || value === undefined ? '' : value).trim();
  }

  function normalizeScopeKey(scopeKey){
    const normalized = String(scopeKey === null || scopeKey === undefined ? '' : scopeKey).trim();
    if(!normalized) throw new Error('案件 Session scope 未設定');
    return normalized;
  }

  function normalizeEmail(user){
    return String(user && user.email || '').trim().toLowerCase();
  }

  function readCaseSessions(){
    const storage = getStorage();
    if(!storage) return {};
    try{
      const raw = storage.getItem(STORAGE_KEY);
      if(!raw) return {};
      const parsed = JSON.parse(raw);
      if(!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return parsed;
    }catch(e){
      return {};
    }
  }

  function writeCaseSessions(sessions){
    const storage = getStorage();
    if(!storage) throw new Error('案件 Session を保存できません');
    storage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    return sessions;
  }

  function createSessionId(existingIds){
    let sessionId = '';
    try{
      if(root.crypto && typeof root.crypto.randomUUID === 'function'){
        sessionId = root.crypto.randomUUID();
      }
    }catch(e){}
    if(!sessionId){
      sessionId = 'case-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    }
    const usedIds = existingIds || [];
    if(usedIds.indexOf(sessionId) >= 0){
      sessionId += '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    }
    return sessionId;
  }

  function snapshotCaseSession(scopeKey, session){
    if(!session) return null;
    return {
      scopeKey: normalizeScopeKey(scopeKey),
      caseName: session.caseName,
      sessionId: session.sessionId,
    };
  }

  function isActiveForUser(session, user, now){
    const email = normalizeEmail(user);
    return !!(
      session &&
      normalizeCaseName(session.caseName) &&
      String(session.sessionId || '').trim() &&
      email &&
      String(session.userEmail || '').trim().toLowerCase() === email &&
      Number.isFinite(Number(session.lastUsedAt)) &&
      Number.isFinite(Number(session.expiresAt)) &&
      Number(session.expiresAt) > (now === undefined ? Date.now() : now)
    );
  }

  function getCaseSession(scopeKey){
    const key = normalizeScopeKey(scopeKey);
    const sessions = readCaseSessions();
    const session = sessions[key];
    return session && typeof session === 'object' ? { ...session } : null;
  }

  function getActiveCaseSession(scopeKey, user){
    const session = getCaseSession(scopeKey);
    return isActiveForUser(session, user) ? session : null;
  }

  function createCaseSession(scopeKey, caseName, user){
    const key = normalizeScopeKey(scopeKey);
    const normalizedName = normalizeCaseName(caseName);
    if(!normalizedName) throw new Error('案件名不能为空');
    const userEmail = normalizeEmail(user);
    if(!userEmail) throw new Error('未登录');

    const now = Date.now();
    const sessions = readCaseSessions();
    const usedIds = Object.keys(sessions).map(sessionKey =>
      sessions[sessionKey] && sessions[sessionKey].sessionId
    ).filter(Boolean);
    const session = {
      caseName: normalizedName,
      sessionId: createSessionId(usedIds),
      userEmail,
      lastUsedAt: now,
      expiresAt: now + TTL_MS,
    };
    sessions[key] = session;
    writeCaseSessions(sessions);
    return { ...session };
  }

  function changeCaseSession(scopeKey, caseName, user){
    return createCaseSession(scopeKey, caseName, user);
  }

  function ensureCaseSession(scopeKey, user, requestCaseName){
    const key = normalizeScopeKey(scopeKey);
    const active = getActiveCaseSession(key, user);
    if(active){
      return { ok: true, created: false, session: active };
    }

    const request = typeof requestCaseName === 'function'
      ? requestCaseName
      : (typeof root.prompt === 'function'
        ? () => root.prompt('案件名を入力してください / 请输入案件名', '')
        : null);
    const requestedName = request ? request() : '';
    if(!normalizeCaseName(requestedName)){
      return { ok: false, error: '案件名不能为空' };
    }

    try{
      return { ok: true, created: true, session: createCaseSession(key, requestedName, user) };
    }catch(error){
      return { ok: false, error: error.message || String(error) };
    }
  }

  function touchCaseSession(executionCase, user){
    if(!executionCase || !String(executionCase.scopeKey || '').trim() ||
       !String(executionCase.sessionId || '').trim()) return null;
    const key = normalizeScopeKey(executionCase.scopeKey);
    const sessions = readCaseSessions();
    const current = sessions[key];
    const userEmail = normalizeEmail(user);
    if(!current || !userEmail) return null;
    if(String(current.sessionId || '') !== String(executionCase.sessionId)) return null;
    if(String(current.userEmail || '').trim().toLowerCase() !== userEmail) return null;

    const now = Date.now();
    const touched = {
      ...current,
      lastUsedAt: now,
      expiresAt: now + TTL_MS,
    };
    sessions[key] = touched;
    writeCaseSessions(sessions);
    return { ...touched };
  }

  root.QCCaseSession = {
    STORAGE_KEY,
    TTL_MS,
    getCaseSession,
    getActiveCaseSession,
    createCaseSession,
    changeCaseSession,
    ensureCaseSession,
    snapshotCaseSession,
    touchCaseSession,
  };
})(typeof window !== 'undefined' ? window : globalThis);
