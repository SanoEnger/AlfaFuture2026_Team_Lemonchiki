"""Compatible identity and assignment extension.

Revision ID: 0002
Revises: 0001
"""
from alembic import op
import sqlalchemy as sa

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users') as batch:
        batch.drop_constraint(op.f('ck_users_role'), type_='check')
        batch.create_check_constraint(op.f('ck_users_role'), "role IN ('CLIENT', 'BANK_EMPLOYEE', 'BANK_OFFICER', 'BANK_ADMIN')")
        batch.add_column(sa.Column('email', sa.String(254), nullable=True))
        batch.add_column(sa.Column('display_name', sa.String(100), nullable=False, server_default=''))
        batch.add_column(sa.Column('status', sa.String(20), nullable=False, server_default='ACTIVE'))
        batch.add_column(sa.Column('session_version', sa.Integer(), nullable=False, server_default='1'))
        batch.add_column(sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
        batch.add_column(sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True))
        batch.create_unique_constraint(op.f('uq_users_email'), ['email'])
    op.execute("UPDATE users SET display_name = username WHERE display_name = ''")
    with op.batch_alter_table('loan_applications') as batch:
        batch.add_column(sa.Column('comment', sa.Text(), nullable=False, server_default=''))
        batch.add_column(sa.Column('revision', sa.Integer(), nullable=False, server_default='1'))
        batch.add_column(sa.Column('assigned_officer_id', sa.Uuid(), nullable=True))
        batch.create_foreign_key(op.f('fk_loan_applications_assigned_officer_id_users'), 'users', ['assigned_officer_id'], ['id'], ondelete='RESTRICT')
        batch.create_index('ix_loan_applications_assigned_officer_id', ['assigned_officer_id'])
    from app.models import AuthSession, IdentityToken, AuditEvent
    for table in (AuthSession.__table__, IdentityToken.__table__, AuditEvent.__table__):
        table.create(op.get_bind())


def downgrade():
    connection = op.get_bind()
    for table in ('auth_sessions', 'identity_tokens', 'audit_events'):
        if connection.scalar(sa.text(f'SELECT count(*) FROM {table}')):
            raise RuntimeError('Identity data exists: export it before any downgrade.')
    if connection.scalar(sa.text("SELECT count(*) FROM users WHERE email IS NOT NULL OR role IN ('BANK_OFFICER','BANK_ADMIN') OR status != 'ACTIVE' OR session_version != 1 OR last_login_at IS NOT NULL OR display_name != username")):
        raise RuntimeError('Identity fields contain user data; downgrade refused.')
    if connection.scalar(sa.text("SELECT count(*) FROM loan_applications WHERE assigned_officer_id IS NOT NULL OR revision != 1 OR comment != ''")):
        raise RuntimeError('Assignment/revision data exists; downgrade refused.')
    for table in ('audit_events', 'identity_tokens', 'auth_sessions'):
        op.drop_table(table)
    with op.batch_alter_table('loan_applications') as batch:
        batch.drop_index('ix_loan_applications_assigned_officer_id')
        batch.drop_constraint('fk_loan_applications_assigned_officer_id_users', type_='foreignkey')
        batch.drop_column('assigned_officer_id')
        batch.drop_column('revision')
        batch.drop_column('comment')
    with op.batch_alter_table('users') as batch:
        batch.drop_constraint('uq_users_email', type_='unique')
        for name in ('email', 'display_name', 'status', 'session_version', 'created_at', 'last_login_at'):
            batch.drop_column(name)
        batch.drop_constraint(op.f('ck_users_role'), type_='check')
        batch.create_check_constraint(op.f('ck_users_role'), "role IN ('CLIENT','BANK_EMPLOYEE')")
