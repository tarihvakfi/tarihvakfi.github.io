begin;
set local role service_role;
set local search_path = public, extensions;

select plan(9);

select is((select count(*) from public.library_shelf_positions), 396::bigint,
  '66 kitaplik x 6 sira = 396 raf gozu');
select ok(exists(select 1 from public.library_shelf_positions where code = 'G-A01'), 'ilk raf var');
select ok(exists(select 1 from public.library_shelf_positions where code = 'G-BA06'), 'giris kat son raf var');
select ok(exists(select 1 from public.library_shelf_positions where code = 'U-BH06'), 'ust kat son raf var');

insert into public.library_books (shelf_position_id, position_number, place_code, title)
select id, 999, 'G-A01-999', 'Karar kurali testi'
from public.library_shelf_positions where code = 'G-A01';

insert into public.library_decision_opinions (book_id, voter_name, choice)
select id, 'Birinci Kisi', 'go' from public.library_books where place_code = 'G-A01-999';
select is((select count(*) from public.library_decision_resolutions where book_id =
  (select id from public.library_books where place_code = 'G-A01-999')), 0::bigint,
  'tek yeni gorus karari kesinlestirmez');

insert into public.library_decision_opinions (book_id, voter_name, choice)
select id, 'Ikinci Kisi', 'go' from public.library_books where place_code = 'G-A01-999';
select is((select kind::text from public.library_decision_resolutions where book_id =
  (select id from public.library_books where place_code = 'G-A01-999')), 'consensus',
  'iki ayni gorus uzlasmayla kesinlesir');

delete from public.library_decision_opinions where book_id =
  (select id from public.library_books where place_code = 'G-A01-999');
insert into public.library_decision_opinions (book_id, voter_name, choice)
select id, 'Birinci Kisi', 'go' from public.library_books where place_code = 'G-A01-999';
insert into public.library_decision_opinions (book_id, voter_name, choice)
select id, 'Ikinci Kisi', 'stay' from public.library_books where place_code = 'G-A01-999';
select is((select count(*) from public.library_decision_resolutions where book_id =
  (select id from public.library_books where place_code = 'G-A01-999')), 0::bigint,
  'farkli gorusler karari kesinlestirmez');

delete from public.library_decision_opinions where book_id =
  (select id from public.library_books where place_code = 'G-A01-999');
insert into public.library_decision_opinions (book_id, voter_name, choice, created_at, updated_at)
select id, 'Birinci Kisi', 'uncertain', now() - interval '31 days', now() - interval '31 days'
from public.library_books where place_code = 'G-A01-999';
select is((select kind::text from public.library_decision_resolutions where book_id =
  (select id from public.library_books where place_code = 'G-A01-999')), 'single_after_30_days',
  'tek gorus 30 gun sonra gecerli olur');

delete from public.library_decision_opinions where book_id =
  (select id from public.library_books where place_code = 'G-A01-999');
select is((select count(*) from public.library_decision_resolutions where book_id =
  (select id from public.library_books where place_code = 'G-A01-999')), 0::bigint,
  'gorus silinince otomatik karar da kalkar');

select * from finish();
rollback;
