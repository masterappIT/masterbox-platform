import React, { useEffect, useState, useMemo } from "react";
import PropTypes from 'prop-types'
import Search from "../../stories/components/Search";
import Button from "../../stories/components/Button";
import Icon from "../../stories/components/Icon";




function TableTop({ searchOnClick, addOnClick, addTitle, deleteOnClick }) {


  return (
    <div className="flex justify-between items-center mb-[20px]">
      <div className='w-[220px]'>
        <Search placeholder='搜尋' onClick={searchOnClick}/>
      </div>
      <div className='flex space-x-2'>
        <Button title='刪除' color='alert' startElement={<Icon name='delete' />} customStyles={{ paddingRight: '10px', paddingLeft: '10px' }} onClick={deleteOnClick}/>
        <Button title={addTitle} startElement={<Icon name='plus' size='small' />} customStyles={{ paddingRight: '10px', paddingLeft: '10px' }} onClick={addOnClick} />
      </div>
    </div>
  );
}

TableTop.propTypes = {
  deleteOnClick: PropTypes.func,
  addOnClick: PropTypes.func,
  searchOnClick: PropTypes.func,
  addTitle: PropTypes.string,
}

TableTop.defaultProps = {
  deleteOnClick:null,
  addOnClick:null,
  searchOnClick:null,
  addTitle:'新增'
}

export default TableTop
