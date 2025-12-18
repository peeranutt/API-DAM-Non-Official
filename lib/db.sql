create table users (
	id SERIAL primary key,
	username varchar(100) UNIQUE NOT NULL,
	password varchar(255) NOT NULL,
	email varchar(100) UNIQUE NOT NULL,
	fullname varchar(100) NOT NULL,
	role varchar(20) check (role IN ('admin', 'edit', 'viewer')) NOT NULL,
	last_login TIMESTAMP,
	created_at TIMESTAMP DEFAULT now(),
	updated_at TIMESTAMP DEFAULT now()
);
create table user_groups (
	id SERIAL primary key,
	name varchar(100) NOT NULL,
	description varchar(255),
	created_at TIMESTAMP DEFAULT now(),
	updated_at TIMESTAMP DEFAULT now()
);
create table group_members (
	id SERIAL primary key,
	group_id int references user_groups(id),
	user_id int references users(id),
	role varchar(20) check (role IN ('member', 'manager')),
	added_at TIMESTAMP DEFAULT now()
);
create table assets (
	id SERIAL primary key,
	original_name varchar(255) NOT NULL,
	filename varchar(255) NOT NULL,
	thumbnail varchar(255),
	file_type varchar(50) NOT NULL,
	file_size BIGINT,
	path varchar NOT NULL,
	keywords array,
	status varchar(20) check (status IN ('active', 'deleted')) NOT NULL,
	create_by int references users(id),
	created_at TIMESTAMP DEFAULT now(),
	updated_at TIMESTAMP DEFAULT now()
);
create table metadata_fields (
	id SERIAL primary key,
	name varchar(100) UNIQUE NOT NULL,
	type varchar(20) check (type IN ('text', 'number', 'date', 'select', 'boolean')) NOT NULL,
	options varchar(255),
	created_at TIMESTAMP DEFAULT now(),
	updated_at TIMESTAMP DEFAULT now()
);
create table asset_metadata (
	id SERIAL primary key,
	asset_id int references assets(id),
	field_id int references metadata_fields(id),
	value varchar(255),
	created_at TIMESTAMP DEFAULT now(),
	updated_at TIMESTAMP DEFAULT now()
);
create table collections (
	id SERIAL primary key,
	parent_id int references collections(id),
	name varchar(100),
	create_by int references users(id),
	created_at TIMESTAMP DEFAULT now(),
	updated_at TIMESTAMP DEFAULT now()
);
create table collection_assets (
	id SERIAL primary key,
	collection_id int references collections(id),
	asset_id int references assets(id),
	added_at TIMESTAMP DEFAULT now()
);
create table permissions (
	id SERIAL primary key,
	user_id int references users(id),
	collection_id int references collections(id),
	asset_id int references assets(id),
	can_view boolean,
	can_edit boolean,
	can_delete boolean,
	created_at TIMESTAMP DEFAULT now(),
	updated_at TIMESTAMP DEFAULT now()
);
create table activity_logs (
	id SERIAL primary key,
	user_id int references users(id),
	collection_id int references collections(id),
	asset_id int references assets(id),
	action varchar(100),
	detail varchar,
	created_at TIMESTAMP DEFAULT now()
);