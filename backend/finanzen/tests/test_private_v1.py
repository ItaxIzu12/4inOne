from decimal import Decimal
from datetime import date
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from core.models import Household, HouseholdMembership
from finanzen.models import Category, Transaction, MonthlyBudget, SavingsGoal

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
    assert r.data['expenses']=='0.30' and r.data['income']=='10.00' and r.data['available']=='0.70'
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
