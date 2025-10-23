create extension if not exists pg_graphql;
create extension if not exists documentdb_core;
create extension if not exists documentdb cascade;

create schema if not exists app;

create or replace function app.graphql(query text, variables jsonb default '{}'::jsonb)
returns jsonb language sql stable as $$
  select graphql.resolve(query, variables);
$$;

grant usage on schema app to postgres;
grant execute on function app.graphql(text, jsonb) to postgres;
