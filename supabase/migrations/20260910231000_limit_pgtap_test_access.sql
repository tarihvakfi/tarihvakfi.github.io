-- pgTAP yalnız kabul testinin geçtiği service_role tarafından çağrılabilir.
revoke usage on schema extensions from public;
grant usage on schema extensions to service_role;
