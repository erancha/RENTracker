import React, { Component } from 'react';
import { bindActionCreators, Dispatch } from 'redux';
import { connect } from 'react-redux';
import { fetchUsers } from '../redux/users/actions';
import { IAppState } from '../redux/store/types';
import { IUser } from '../redux/users/types';

class Users extends Component<IUsersProps> {
  componentDidMount() {
    if (this.props.JWT) {
      this.props.fetchUsers(this.props.JWT);
    }
  }

  componentDidUpdate(prevProps: IUsersProps) {
    if (prevProps.JWT !== this.props.JWT && this.props.JWT) {
      this.props.fetchUsers(this.props.JWT);
    }
  }

  render() {
    const { loading, error, users } = this.props;

    return loading ? (
      <div className='cards loading'>Loading users...</div>
    ) : error ? (
      <div className='cards error'>Error: {error}</div>
    ) : (
      <div className='page users-container'>
        <div className='header'>Users</div>
        <div className='cards-list'>
          {users.map((user: IUser) => (
            <div key={user.user_id} className='card'>
              <h3 className='user-name' title='user-name'>
                {user.user_name}
              </h3>
              <div className='details'>
                <div className='email'>{user.email_address}</div>
                <div className='created date'>{new Date(user.created_at).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
}

interface IUsersProps {
  users: IUser[];
  loading: boolean;
  error: string | null;
  JWT: string | null;
  fetchUsers: typeof fetchUsers;
}

const mapStateToProps = (state: IAppState) => ({
  users: state.users.list,
  loading: state.users.loading,
  error: state.users.error,
  JWT: state.auth.JWT,
});

const mapDispatchToProps = (dispatch: Dispatch) =>
  bindActionCreators(
    {
      fetchUsers,
    },
    dispatch
  );

export default connect(mapStateToProps, mapDispatchToProps)(Users);
