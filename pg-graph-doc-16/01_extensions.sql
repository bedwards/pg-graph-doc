create extension if not exists pg_graphql;
create extension if not exists documentdb_core;
create extension if not exists documentdb cascade;

create or replace function graphql(query text, variables jsonb default '{}'::jsonb)
returns jsonb language sql volatile as $$
  select graphql.resolve(query, variables);
$$;

grant execute on function graphql(text, jsonb) to postgres;
