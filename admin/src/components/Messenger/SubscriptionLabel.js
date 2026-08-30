import React from 'react'
import PropTypes from 'prop-types'
import List from '../../stories/components/List';
import ChatroomItem from '../../stories/components/ChatroomItem';
import ContentText from '../../stories/components/ContentText';
import ListItem from '../../stories/components/ListItem';
import Icon from '../../stories/components/Icon';
import Headline from '../../stories/components/Headline';
import Button from '../../stories/components/Button';


function SubscriptionLabel({ isSubscription, onClick }) {

  return (
    <Button size='small' title={isSubscription ? '已訂閱' : '未訂閱'} rounded='small' customStyles={{ padding: '4px 6px', height: '20px', width: '52px', cursor: 'default' }} variant={isSubscription ? 'contained' : 'outlined'} color='tertiary' onClick={onClick} />
  );

}

SubscriptionLabel.propTypes = {
  isSubscription: PropTypes.bool.isRequired,
  // title: PropTypes.string,
  // variant: PropTypes.oneOf(['primary', 'secondary', 'tertiary', 'quaternary']),
  // customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  // onClick: PropTypes.func,
}

SubscriptionLabel.defaultProps = {
  isSubscription: false,
  // title: 'Input',
  // color: 'primary',
  // customStyles: null,
  // onClick: null,
}

export default SubscriptionLabel
