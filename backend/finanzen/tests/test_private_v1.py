from decimal import Decimal
from datetime import date, timedelta
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from core.models import Household, HouseholdMembership
from django.utils import timezone
from finanzen.models import Category, Transaction, MonthlyBudget, SavingsGoal, SavingsContribution

pytestmark=pytest.mark.django_db
BASE='/api/v1/finanzen/private/'
@pytest.fixture
def ctx():
    a=get_user_model().objects.create_user(username='private-a')
    b=get_user_model().objects.create_user(username='private-b')
    home=Household.objects.create(name='Same household')
    for user in [a,b]: HouseholdMembership.objects.create(user=user,household=home)
    client=APIClient();client.force_authenticate(a)
    return a,b,home,client

@pytest.mark.parametrize('resource',['transactions','budgets','goals'])
def test_crud_owner_isolation_in_same_household(ctx,resource):
    a,b,home,c=ctx
    category=Category.objects.create(owner=a,name='Privat')
    payload={'transactions':{'amount':'12.34','type':'EXPENSE','category':category.id,'date':'2026-09-25'},'budgets':{'amount':'3000.00','month':'2026-09-01'},'goals':{'title':'Waschmaschine','target_amount':'700.00','current_amount':'480.00'}}[resource]
    r=c.post(BASE+resource+'/',{**payload,'owner':b.pk,'account':99,'household':home.pk},format='json')
    assert r.status_code==201,r.data
    pk=r.data['id'];url=f'{BASE}{resource}/{pk}/'
    model={'transactions':Transaction,'budgets':MonthlyBudget,'goals':SavingsGoal}[resource]
    assert model.objects.get(pk=pk).owner==a
    assert len(c.get(BASE+resource+'/').data)==1
    c.force_authenticate(b)
    assert c.get(BASE+resource+'/').data==[]
    assert c.get(BASE+'summary/?month=2026-09').data['has_data'] is False
    for method in ['get','patch','put','delete']:
        assert getattr(c,method)(url,payload,format='json').status_code==404
    c.force_authenticate(a)
    assert c.patch(url,payload,format='json').status_code==200
    assert c.delete(url).status_code==204
    assert not model.objects.filter(pk=pk).exists()


def test_foreign_category_and_legacy_endpoints(ctx):
    a,b,home,c=ctx
    other=Category.objects.create(owner=b,name='B privat');own=Category.objects.create(owner=a,name='A privat')
    payload={'amount':'10.00','type':'EXPENSE','date':'2026-09-25','category':other.id}
    assert c.post(BASE+'transactions/',payload,format='json').status_code==400
    payload['category']=Category.objects.filter(household=home).first().id
    assert c.post(BASE+'transactions/',payload,format='json').status_code==400
    payload['category']=own.id
    r=c.post(BASE+'transactions/',payload,format='json');assert r.status_code==201
    assert c.get(f"/api/v1/finanzen/transaktionen/{r.data['id']}/").status_code==404
    assert c.get(f'/api/v1/finanzen/kategorien/{own.id}/').status_code==404
    assert c.post('/api/v1/finanzen/transaktionen/',{'amount':'10.00','category_id':own.id,'datum':'2026-09-25'},format='json').status_code==400
    c.force_authenticate(b)
    assert c.get(f'{BASE}categories/{own.id}/').status_code==404


def test_summary_exact_decimals_month_boundaries(ctx):
    a,b,home,c=ctx
    category=Category.objects.create(owner=a,name='Lebensmittel')
    for amount,kind,day in [('0.10','EXPENSE','2026-09-01'),('0.20','EXPENSE','2026-09-30'),('10.00','INCOME','2026-09-25'),('99.00','EXPENSE','2026-10-01')]:
        Transaction.objects.create(owner=a,category=category,amount=Decimal(amount),type=kind,datum=day)
    Transaction.objects.create(owner=b,amount=Decimal('1000'),datum='2026-09-25')
    MonthlyBudget.objects.create(owner=a,amount=Decimal('1.00'),month=date(2026,9,1))
    SavingsGoal.objects.create(owner=a,title='Ziel',target_amount=Decimal('700'),current_amount=Decimal('480'))
    r=c.get(BASE+'summary/?month=2026-09')
    assert r.data['expenses']=='0.30' and r.data['income']=='10.00' and r.data['available']=='10.70' and r.data['total']=='11.00'
    assert r.data['savings_current']=='480.00'
    assert r.data['categories']==[{'name':'Lebensmittel','amount':'0.30'}]
    assert len(r.data['recent'])==3 and r['Cache-Control']=='no-store'


def test_budget_duplicate_zero_and_validation(ctx):
    *_,c=ctx
    r=c.post(BASE+'budgets/',{'month':'2026-09-25','amount':'0.00'},format='json')
    assert r.status_code==201 and r.data['month']=='2026-09-01'
    assert c.post(BASE+'budgets/',{'month':'2026-09-01','amount':'100'},format='json').status_code==400
    assert c.patch(f"{BASE}budgets/{r.data['id']}/",{'amount':'3000.00'},format='json').status_code==200
    for amount in ['-1','1.123','NaN','100000000.00']:
        assert c.post(BASE+'goals/',{'title':'X','target_amount':amount},format='json').status_code==400
    assert c.post(BASE+'goals/',{'title':'X','target_amount':'700','currency':'USD'},format='json').status_code==400
    assert c.get(BASE+'summary/?month=nonsense').status_code==400


def test_empty_without_household_and_idempotent_categories():
    user=get_user_model().objects.create_user(username='no-home');c=APIClient();c.force_authenticate(user)
    r=c.get(BASE+'summary/')
    assert r.status_code==200 and not r.data['has_data'] and r.data['available'] is None
    assert r.data['expenses']=='0.00' and c.get(BASE+'categories/').data==[]
    for _ in range(2): assert len(c.post(BASE+'categories/setup/').data)==7
    assert Category.objects.filter(owner=user).count()==7 and not user.households.exists()

@pytest.mark.parametrize('resource',['transactions','budgets','goals','categories','summary'])
def test_auth_required(resource):
    assert APIClient().get(BASE+resource+'/').status_code==401


def test_income_raises_available_budget_and_expense_lowers_it(ctx):
    a,b,home,c=ctx
    category=Category.objects.create(owner=a,name='Lebensmittel')
    MonthlyBudget.objects.create(owner=a,amount=Decimal('3000.00'),month=date(2026,9,1))
    def summary(): return c.get(BASE+'summary/?month=2026-09').data
    assert summary()['available']=='3000.00' and summary()['total']=='3000.00'

    r=c.post(BASE+'transactions/',{'amount':'100.00','type':'INCOME','category':category.id,'date':'2026-09-10'},format='json')
    assert r.status_code==201
    s=summary(); assert (s['income'],s['total'],s['available'])==('100.00','3100.00','3100.00')

    c.post(BASE+'transactions/',{'amount':'48.32','type':'EXPENSE','category':category.id,'date':'2026-09-11'},format='json')
    s=summary(); assert (s['expenses'],s['available'])==('48.32','3051.68')

    # Einnahme wieder löschen → Budget sinkt zurück
    c.delete(f"{BASE}transactions/{r.data['id']}/")
    assert summary()['available']=='2951.68'


def test_income_in_other_month_or_of_other_user_does_not_change_available(ctx):
    a,b,home,c=ctx
    category=Category.objects.create(owner=a,name='X')
    MonthlyBudget.objects.create(owner=a,amount=Decimal('500.00'),month=date(2026,9,1))
    Transaction.objects.create(owner=a,category=category,amount=Decimal('80'),type='INCOME',datum='2026-08-31')
    Transaction.objects.create(owner=b,amount=Decimal('999'),type='INCOME',datum='2026-09-15')
    assert c.get(BASE+'summary/?month=2026-09').data['available']=='500.00'


def test_income_without_budget_is_shown_but_available_stays_empty(ctx):
    a,b,home,c=ctx
    category=Category.objects.create(owner=a,name='X')
    Transaction.objects.create(owner=a,category=category,amount=Decimal('80'),type='INCOME',datum='2026-09-15')
    s=c.get(BASE+'summary/?month=2026-09').data
    assert s['income']=='80.00' and s['available'] is None and s['total'] is None


# ---------------------------------------------------------------------------
# Sparziele: Obergrenze und Wirkung aufs Budget
# ---------------------------------------------------------------------------

def _month(): return timezone.localdate().strftime('%Y-%m')

def _summary(c): return c.get(BASE+'summary/?month='+_month()).data

@pytest.fixture
def budget_ctx(ctx):
    a,b,home,c=ctx
    MonthlyBudget.objects.create(owner=a,amount=Decimal('3000.00'),month=timezone.localdate().replace(day=1))
    return ctx

def test_saved_amount_cannot_exceed_the_goal(ctx):
    *_,c=ctx
    r=c.post(BASE+'goals/',{'title':'Fahrrad','target_amount':'500','current_amount':'500.01'},format='json')
    assert r.status_code==400 and 'current_amount' in r.data
    ok=c.post(BASE+'goals/',{'title':'Fahrrad','target_amount':'500','current_amount':'500'},format='json')
    assert ok.status_code==201  # genau das Ziel ist erlaubt
    url=f"{BASE}goals/{ok.data['id']}/"
    assert c.patch(url,{'current_amount':'501'},format='json').status_code==400
    # Ziel im selben Zug erhöhen ist erlaubt
    assert c.patch(url,{'current_amount':'501','target_amount':'600'},format='json').status_code==200
    assert SavingsGoal.objects.get(pk=ok.data['id']).current_amount==Decimal('501.00')

def test_target_cannot_be_lowered_below_the_saved_amount(ctx):
    *_,c=ctx
    g=c.post(BASE+'goals/',{'title':'Reise','target_amount':'700','current_amount':'480'},format='json').data
    url=f"{BASE}goals/{g['id']}/"
    r=c.patch(url,{'target_amount':'400'},format='json')
    assert r.status_code==400 and 'target_amount' in r.data
    assert c.put(url,{'title':'Reise','target_amount':'400','current_amount':'480'},format='json').status_code==400
    assert c.patch(url,{'target_amount':'480'},format='json').status_code==200
    assert SavingsGoal.objects.get(pk=g['id']).target_amount==Decimal('480.00')

def test_saving_reduces_available_budget_in_the_month_it_happens(budget_ctx):
    a,b,home,c=budget_ctx
    assert _summary(c)['available']=='3000.00' and _summary(c)['saved']=='0.00'

    g=c.post(BASE+'goals/',{'title':'Waschmaschine','target_amount':'700','current_amount':'480'},format='json').data
    s=_summary(c); assert (s['saved'],s['available'])==('480.00','2520.00')

    # mehr gespart: nur die Differenz kommt dazu
    c.patch(f"{BASE}goals/{g['id']}/",{'current_amount':'530'},format='json')
    s=_summary(c); assert (s['saved'],s['available'])==('530.00','2470.00')

    # zurückgenommen (Entnahme): das Geld ist wieder frei
    c.patch(f"{BASE}goals/{g['id']}/",{'current_amount':'100'},format='json')
    s=_summary(c); assert (s['saved'],s['available'])==('100.00','2900.00')

    # nur Titel ändern: keine neue Einzahlung
    c.patch(f"{BASE}goals/{g['id']}/",{'title':'Neue Waschmaschine'},format='json')
    assert _summary(c)['available']=='2900.00'
    assert SavingsContribution.objects.filter(goal_id=g['id']).count()==3

def test_saving_combines_with_income_and_expenses(budget_ctx):
    a,b,home,c=budget_ctx
    cat=Category.objects.create(owner=a,name='X')
    today=timezone.localdate().isoformat()
    Transaction.objects.create(owner=a,category=cat,amount=Decimal('200'),type='INCOME',datum=today)
    Transaction.objects.create(owner=a,category=cat,amount=Decimal('50'),type='EXPENSE',datum=today)
    c.post(BASE+'goals/',{'title':'G','target_amount':'700','current_amount':'100'},format='json')
    s=_summary(c)
    assert (s['total'],s['expenses'],s['saved'],s['available'])==('3200.00','50.00','100.00','3050.00')

def test_saving_does_not_touch_other_months_or_other_users(budget_ctx):
    a,b,home,c=budget_ctx
    c.post(BASE+'goals/',{'title':'G','target_amount':'700','current_amount':'100'},format='json')
    other=timezone.localdate().replace(day=1)-timedelta(days=1)
    r=c.get(BASE+'summary/?month='+other.strftime('%Y-%m')).data
    assert r['saved']=='0.00'
    SavingsContribution.objects.create(owner=b,goal=SavingsGoal.objects.create(owner=b,title='B',target_amount=Decimal('9')),amount=Decimal('9'),date=timezone.localdate())
    assert _summary(c)['saved']=='100.00'

def test_deleting_a_goal_releases_the_saved_money(budget_ctx):
    a,b,home,c=budget_ctx
    g=c.post(BASE+'goals/',{'title':'G','target_amount':'700','current_amount':'300'},format='json').data
    assert _summary(c)['available']=='2700.00'
    assert c.delete(f"{BASE}goals/{g['id']}/").status_code==204
    assert _summary(c)['available']=='3000.00' and not SavingsContribution.objects.exists()

def test_goal_without_saved_amount_creates_no_contribution(budget_ctx):
    *_,c=budget_ctx
    c.post(BASE+'goals/',{'title':'Leer','target_amount':'700'},format='json')
    assert not SavingsContribution.objects.exists() and _summary(c)['available']=='3000.00'

def test_migration_backfill_counts_existing_saved_amounts_once():
    from importlib import import_module
    from django.apps import apps as django_apps
    user=get_user_model().objects.create_user(username='bf')
    g=SavingsGoal.objects.create(owner=user,title='Alt',target_amount=Decimal('500'),current_amount=Decimal('300'))
    empty=SavingsGoal.objects.create(owner=user,title='Leer',target_amount=Decimal('500'))
    backfill=import_module('finanzen.migrations.0014_savings_contribution').backfill_contributions
    backfill(django_apps,None); backfill(django_apps,None)  # zweimal: keine Dopplung
    rows=list(SavingsContribution.objects.values_list('goal_id','amount','date'))
    assert rows==[(g.pk,Decimal('300.00'),g.created_at.date())] and empty.pk not in [r[0] for r in rows]


# ---------------------------------------------------------------------------
# Budget-Zeitraum (mehrere Monate / bis auf Weiteres)
# ---------------------------------------------------------------------------

def _avail(c,month): return c.get(BASE+f'summary/?month={month}').data['available']

def _post_budget(c,**body): return c.post(BASE+'budgets/',body,format='json')

def test_budget_defaults_to_a_single_month(ctx):
    *_,c=ctx
    r=_post_budget(c,month='2026-09-01',amount='3000')
    assert r.status_code==201 and r.data['end_month'] is None and r.data['open_ended'] is False
    assert _avail(c,'2026-09')=='3000.00' and _avail(c,'2026-10') is None

def test_budget_for_a_range_of_months(ctx):
    *_,c=ctx
    r=_post_budget(c,month='2026-09-15',end_month='2026-11-20',amount='2500')
    assert r.status_code==201 and r.data['month']=='2026-09-01' and r.data['end_month']=='2026-11-01'
    assert [_avail(c,m) for m in ('2026-08','2026-09','2026-10','2026-11','2026-12')]==[None,'2500.00','2500.00','2500.00',None]

def test_open_ended_budget_runs_until_replaced(ctx):
    *_,c=ctx
    r=_post_budget(c,month='2026-09-01',open_ended=True,amount='2000')
    assert r.status_code==201 and r.data['open_ended'] is True and r.data['end_month'] is None
    assert [_avail(c,m) for m in ('2026-08','2026-09','2027-06','2030-01')]==[None,'2000.00','2000.00','2000.00']

def test_later_budget_overrides_and_a_single_month_falls_back_afterwards(ctx):
    *_,c=ctx
    _post_budget(c,month='2026-09-01',open_ended=True,amount='2000')
    _post_budget(c,month='2026-12-01',amount='3500')            # nur Dezember, z. B. Weihnachten
    assert [_avail(c,m) for m in ('2026-11','2026-12','2027-01')]==['2000.00','3500.00','2000.00']
    _post_budget(c,month='2027-03-01',open_ended=True,amount='2400')  # ab März dauerhaft neu
    assert [_avail(c,m) for m in ('2027-02','2027-03','2028-01')]==['2000.00','2400.00','2400.00']

def test_budget_range_validation(ctx):
    *_,c=ctx
    assert _post_budget(c,month='2026-09-01',end_month='2026-08-01',amount='1').status_code==400
    both=_post_budget(c,month='2026-09-01',end_month='2026-12-01',open_ended=True,amount='1')
    assert both.status_code==201 and both.data['end_month'] is None  # „bis auf Weiteres“ gewinnt, kein Ende
    assert _post_budget(c,month='2026-09-01',amount='1').status_code==400  # Start-Monat schon vergeben

def test_editing_a_budget_range(ctx):
    *_,c=ctx
    b=_post_budget(c,month='2026-09-01',amount='1000').data
    url=f"{BASE}budgets/{b['id']}/"
    assert c.patch(url,{'end_month':'2026-12-01'},format='json').status_code==200 and _avail(c,'2026-11')=='1000.00'
    assert c.patch(url,{'end_month':'2026-08-01'},format='json').status_code==400          # vor dem Start
    assert c.patch(url,{'open_ended':True},format='json').data['end_month'] is None and _avail(c,'2030-01')=='1000.00'
    assert c.patch(url,{'open_ended':False},format='json').status_code==200 and _avail(c,'2026-10') is None  # wieder ein Monat
    assert c.patch(url,{'month':'2026-11-01'},format='json').data['month']=='2026-11-01'
    assert c.patch(url,{'end_month':'2026-10-01'},format='json').status_code==400          # Start wurde nach hinten verschoben

def test_other_users_range_budget_is_invisible(ctx):
    a,b,home,c=ctx
    MonthlyBudget.objects.create(owner=b,month=date(2026,9,1),open_ended=True,amount=Decimal('9999'))
    assert _avail(c,'2026-10') is None
    assert MonthlyBudget.for_month(a,date(2026,10,1)) is None

def test_range_budget_together_with_income_expense_and_saving(ctx):
    a,b,home,c=ctx
    _post_budget(c,month='2026-09-01',open_ended=True,amount='3000')
    cat=Category.objects.create(owner=a,name='X')
    Transaction.objects.create(owner=a,category=cat,amount=Decimal('100'),type='INCOME',datum='2026-11-05')
    Transaction.objects.create(owner=a,category=cat,amount=Decimal('40'),type='EXPENSE',datum='2026-11-06')
    s=c.get(BASE+'summary/?month=2026-11').data
    assert (s['budget'],s['total'],s['available'])==('3000.00','3100.00','3060.00')

def test_database_rejects_impossible_budget_ranges(ctx):
    a,*_=ctx
    from django.db import IntegrityError, transaction
    with pytest.raises(IntegrityError), transaction.atomic():
        MonthlyBudget.objects.create(owner=a,month=date(2026,9,1),end_month=date(2026,8,1),amount=Decimal('1'))
    with pytest.raises(IntegrityError), transaction.atomic():
        MonthlyBudget.objects.create(owner=a,month=date(2026,9,1),end_month=date(2026,12,1),open_ended=True,amount=Decimal('1'))

def test_covers_helper():
    one=MonthlyBudget(month=date(2026,9,1),amount=Decimal('1'))
    span=MonthlyBudget(month=date(2026,9,1),end_month=date(2026,11,1),amount=Decimal('1'))
    open_=MonthlyBudget(month=date(2026,9,1),open_ended=True,amount=Decimal('1'))
    m=lambda mo: date(2026,mo,1)
    assert [one.covers(m(x)) for x in (8,9,10)]==[False,True,False]
    assert [span.covers(m(x)) for x in (8,9,11,12)]==[False,True,True,False]
    assert [open_.covers(m(x)) for x in (8,9,12)]==[False,True,True]


# ---------------------------------------------------------------------------
# Sparrate mit Zeitraum
# ---------------------------------------------------------------------------

from finanzen.savings import reserved_for_month

D=lambda y,m: date(y,m,1)

def _plan_goal(owner,target='200',rate='50',start=D(2026,9),end=None,open_ended=False,status='ACTIVE',title='Reisen'):
    return SavingsGoal.objects.create(owner=owner,title=title,target_amount=Decimal(target),monthly_amount=Decimal(rate),
        plan_month=start,plan_end_month=end,plan_open_ended=open_ended,status=status)

def _contrib(goal,amount,day): return SavingsContribution.objects.create(owner=goal.owner,goal=goal,amount=Decimal(amount),date=day)

def _row(owner,months): return [tuple(str(x) for x in reserved_for_month(owner,m)) for m in months]

def test_plan_single_month_range_and_open(ctx):
    a,*_=ctx
    _plan_goal(a,target='1000',start=D(2026,9))                                   # nur September
    assert _row(a,[D(2026,8),D(2026,9),D(2026,10)])==[('0.00','0.00'),('50.00','50.00'),('0.00','0.00')]
    SavingsGoal.objects.all().delete()
    _plan_goal(a,target='1000',start=D(2026,9),end=D(2026,11))                    # September bis November
    assert [t for t,_ in _row(a,[D(2026,8),D(2026,9),D(2026,11),D(2026,12)])]==['0.00','50.00','50.00','0.00']
    SavingsGoal.objects.all().delete()
    _plan_goal(a,target='1000',start=D(2026,9),open_ended=True)                   # bis das Ziel erreicht ist
    assert [t for t,_ in _row(a,[D(2026,8),D(2026,9),D(2027,6),D(2028,1)])]==['0.00','50.00','50.00','50.00']

def test_plan_stops_when_the_goal_would_be_reached(ctx):
    a,*_=ctx
    _plan_goal(a,target='120',rate='50',open_ended=True)   # 50 + 50 + 20, dann fertig
    assert [t for t,_ in _row(a,[D(2026,9),D(2026,10),D(2026,11),D(2026,12),D(2027,5)])]==['50.00','50.00','20.00','0.00','0.00']

def test_plan_counts_what_was_already_saved_before_the_start(ctx):
    a,*_=ctx
    g=_plan_goal(a,target='200',rate='50',open_ended=True)
    _contrib(g,'150',date(2026,8,20))                      # vor dem Planstart
    assert [t for t,_ in _row(a,[D(2026,8),D(2026,9),D(2026,10)])]==['150.00','50.00','0.00']

def test_more_saved_than_planned_counts_actual_and_less_keeps_the_plan(ctx):
    a,*_=ctx
    g=_plan_goal(a,target='300',rate='50',end=D(2026,11))
    _contrib(g,'80',date(2026,9,10))    # mehr als geplant
    _contrib(g,'20',date(2026,10,10))   # weniger als geplant
    assert _row(a,[D(2026,9),D(2026,10),D(2026,11)])==[('80.00','0.00'),('50.00','30.00'),('50.00','50.00')]

def test_paused_or_completed_goal_reserves_nothing_but_actual_still_counts(ctx):
    a,*_=ctx
    g=_plan_goal(a,target='1000',status='PAUSED')
    _contrib(g,'40',date(2026,9,5))
    assert _row(a,[D(2026,9),D(2026,10)])==[('40.00','0.00'),('0.00','0.00')]
    g.status='COMPLETED'; g.save()
    assert _row(a,[D(2026,10)])==[('0.00','0.00')]

def test_goals_without_plan_behave_as_before_and_goals_add_up(ctx):
    a,*_=ctx
    plain=SavingsGoal.objects.create(owner=a,title='Ohne Plan',target_amount=Decimal('500'))
    _contrib(plain,'100',date(2026,9,3))
    _plan_goal(a,target='1000',rate='50',start=D(2026,9),end=D(2026,10))
    assert _row(a,[D(2026,9),D(2026,10),D(2026,11)])==[('150.00','50.00'),('50.00','50.00'),('0.00','0.00')]

def test_plan_is_private_per_user(ctx):
    a,b,home,c=ctx
    _plan_goal(b,target='1000',open_ended=True)
    assert _row(a,[D(2026,9)])==[('0.00','0.00')] and _row(b,[D(2026,9)])==[('50.00','50.00')]

def test_summary_reserves_the_planned_rate_and_reports_the_planned_part(ctx):
    a,b,home,c=ctx
    MonthlyBudget.objects.create(owner=a,amount=Decimal('3000'),month=D(2026,9),open_ended=True)
    _plan_goal(a,target='1000',rate='50',start=D(2026,9),end=D(2026,11))
    s=c.get(BASE+'summary/?month=2026-10').data
    assert (s['saved'],s['saved_planned'],s['available'])==('50.00','50.00','2950.00')
    assert c.get(BASE+'summary/?month=2026-12').data['available']=='3000.00'

def test_goal_api_accepts_a_plan_and_defaults_the_start_month(ctx):
    *_,c=ctx
    r=c.post(BASE+'goals/',{'title':'Reisen','target_amount':'500','monthly_amount':'50','plan_open_ended':True},format='json')
    assert r.status_code==201 and r.data['monthly_amount']=='50.00' and r.data['plan_open_ended'] is True
    assert r.data['plan_month']==timezone.localdate().replace(day=1).isoformat() and r.data['plan_end_month'] is None
    r2=c.post(BASE+'goals/',{'title':'B','target_amount':'500','monthly_amount':'50','plan_month':'2026-09-17','plan_end_month':'2026-12-20'},format='json')
    assert (r2.data['plan_month'],r2.data['plan_end_month'])==('2026-09-01','2026-12-01')

def test_goal_plan_validation(ctx):
    *_,c=ctx
    base={'title':'X','target_amount':'500','monthly_amount':'50','plan_month':'2026-09-01'}
    assert c.post(BASE+'goals/',{**base,'plan_end_month':'2026-08-01'},format='json').status_code==400     # Ende vor Start
    assert c.post(BASE+'goals/',{**base,'monthly_amount':'501'},format='json').status_code==400          # Rate über Ziel
    assert c.post(BASE+'goals/',{**base,'monthly_amount':'0'},format='json').status_code==400
    both=c.post(BASE+'goals/',{**base,'plan_end_month':'2026-12-01','plan_open_ended':True},format='json')
    assert both.status_code==201 and both.data['plan_end_month'] is None                                  # „bis Ziel erreicht“ gewinnt
    # ohne Rate gibt es keinen Zeitraum
    none=c.post(BASE+'goals/',{'title':'Y','target_amount':'500','plan_month':'2026-09-01','plan_open_ended':True},format='json')
    assert none.data['monthly_amount'] is None and none.data['plan_month'] is None and none.data['plan_open_ended'] is False

def test_editing_and_removing_a_plan(ctx):
    *_,c=ctx
    g=c.post(BASE+'goals/',{'title':'R','target_amount':'500','monthly_amount':'50','plan_month':'2026-09-01'},format='json').data
    url=f"{BASE}goals/{g['id']}/"
    assert c.patch(url,{'plan_end_month':'2026-12-01'},format='json').data['plan_end_month']=='2026-12-01'
    assert c.patch(url,{'target_amount':'40'},format='json').status_code==400          # Ziel unter der Rate
    assert c.patch(url,{'plan_open_ended':True},format='json').data['plan_end_month'] is None
    cleared=c.patch(url,{'monthly_amount':None},format='json').data
    assert cleared['monthly_amount'] is None and cleared['plan_month'] is None and cleared['plan_open_ended'] is False
    assert c.patch(url,{'title':'Neu'},format='json').status_code==200 and SavingsGoal.objects.get(pk=g['id']).monthly_amount is None

def test_database_rejects_impossible_plans(ctx):
    a,*_=ctx
    from django.db import IntegrityError, transaction
    def make(**kw):
        with pytest.raises(IntegrityError), transaction.atomic():
            SavingsGoal.objects.create(owner=a,title='X',target_amount=Decimal('9'),**kw)
    make(monthly_amount=Decimal('0'),plan_month=D(2026,9))
    make(monthly_amount=Decimal('5'))                                                     # Rate ohne Start
    make(monthly_amount=Decimal('5'),plan_month=D(2026,9),plan_end_month=D(2026,8))
    make(monthly_amount=Decimal('5'),plan_month=D(2026,9),plan_end_month=D(2026,10),plan_open_ended=True)

def test_plan_calculation_is_bounded_and_fast_for_far_future_months(ctx):
    a,*_=ctx
    _plan_goal(a,target='1000000',rate='1',start=D(2026,9),open_ended=True)
    assert str(reserved_for_month(a,D(2100,1))[0])=='1.00'
