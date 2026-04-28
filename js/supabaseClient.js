(function initContaBlizaSupabase(global){
  const config = {
    url: "https://bfbvlmrwbkyekbiloiyo.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmYnZsbXJ3Ymt5ZWtiaWxvaXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTE5MjQsImV4cCI6MjA5Mjk2NzkyNH0.jt9CpiziR2ergJbyWfkEfy05xjXWAvFp2fu3DEA7VO8"
  };

  function createClient(){
    if(!global.supabase || typeof global.supabase.createClient !== "function"){
      console.warn("Supabase JS no esta disponible. La app sigue usando datos locales.");
      return null;
    }

    return global.supabase.createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }

  global.CB_SUPABASE_CONFIG = config;
  global.cbSupabase = createClient();
  global.cbHasSupabase = function cbHasSupabase(){
    return !!global.cbSupabase;
  };
})(window);
