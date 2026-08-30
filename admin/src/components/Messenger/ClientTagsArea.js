import React from 'react'
import PropTypes from 'prop-types'
import List from '../../stories/components/List';
import ChatroomItem from '../../stories/components/ChatroomItem';
import ContentText from '../../stories/components/ContentText';
import ListItem from '../../stories/components/ListItem';
import Icon from '../../stories/components/Icon';
import Headline from '../../stories/components/Headline';
import Tag from '../../stories/components/Tag';
import Input from '../../stories/components/Input';
import TextArea from '../../stories/components/TextArea';


function ClientTagsArea({ chatPeopleTags, deleteTag, pressHandler }) {

  return (
    <div className="space-y-4">
      <Input placeholder="新增用戶標籤" onKeyPress={pressHandler} title='用戶標籤'>
        <div className="messenger-sideInfo-tags-list">
          {Object.values(chatPeopleTags).map((tag, i) => {
            return <Tag key={i} title={tag} onClick={deleteTag} />
          })}
        </div>
      </Input>
      <TextArea title='備註'  placeholder="您可以在這對此用戶留下註解"
      />
    </div>
  );

}

ClientTagsArea.propTypes = {
  // title: PropTypes.string,
  // variant: PropTypes.oneOf(['primary', 'secondary', 'tertiary', 'quaternary']),
  // customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  // onClick: PropTypes.func,
}

ClientTagsArea.defaultProps = {
  // title: 'Input',
  // color: 'primary',
  // customStyles: null,
  // onClick: null,
}

export default ClientTagsArea
