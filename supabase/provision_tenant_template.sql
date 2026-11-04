-- Скопируйте этот файл, поменяйте slug и запустите один раз для новой компании.
-- Slug должен совпадать со значением tenantSlug в site-config.js.

do $provision$
declare
  v_slug text := 'new-company'; -- замените на латинский slug компании
begin
  insert into public.tenants (slug, is_active)
  values (v_slug, true)
  on conflict (slug) do update set is_active = true;

  insert into public.materials (tenant_slug, name, description, price_per_ton, density, sort_order)
  values
    (v_slug,'Песок речной','Мытый песок для бетона и стяжки',650,1.50,10),
    (v_slug,'Песок карьерный','Для кладки, подушки и засыпки',480,1.45,20),
    (v_slug,'Щебень 5–20 мм','Для фундамента и бетона',1250,1.40,30),
    (v_slug,'ПГС / ОПГС','Песчано-гравийная смесь',720,1.60,40),
    (v_slug,'Чернозём','Плодородный слой',600,1.20,50)
  on conflict (tenant_slug, name) do nothing;

  insert into public.trucks (tenant_slug, name, description, max_tons, base_delivery_price, class_key, sort_order)
  values
    (v_slug,'Малый самосвал','Для небольших участков и узких проездов',5,2000,'small',10),
    (v_slug,'Средний самосвал','Универсальная машина',15,2500,'medium',20),
    (v_slug,'Большой самосвал','Для крупных объёмов',30,4000,'large',30)
  on conflict (tenant_slug, name) do nothing;

  insert into public.delivery_zones (tenant_slug, key, name, price_small, price_medium, price_large, sort_order)
  values
    (v_slug,'city','Город',2000,2500,4000,10),
    (v_slug,'suburb','Ближний пригород',2500,3000,4500,20),
    (v_slug,'far','Дальний пригород',3500,4300,6500,30)
  on conflict (tenant_slug, key) do nothing;
end
$provision$;

-- После создания пользователя в Authentication -> Users скопируйте его UUID
-- и выполните отдельно:
-- insert into public.tenant_memberships (tenant_slug, user_id, role)
-- values ('new-company', 'UUID-ИЗ-AUTH-USERS', 'owner');
