import React from "react";
import PropTypes from 'prop-types'
import Search from "../../stories/components/Search";
import Button from "../../stories/components/Button";

/**
 * Search field and actions above a table; filters go underneath as children.
 * Leave out deleteOnClick or addOnClick to hide that button.
 */
function TableTop({ searchOnChange, searchPlaceholder, addOnClick, addTitle, addDisabled, addHint, deleteOnClick, deleteDisabled, deleteHint, children }) {
  return (
    <div className="flex flex-col gap-y-[20px] mb-[12px]">
      <div className="flex flex-wrap justify-between items-start gap-[12px]">
        <div className='w-[220px]'>
          <Search placeholder={searchPlaceholder} onChange={searchOnChange} />
        </div>
        <div className='flex flex-wrap gap-[8px]'>
          {deleteOnClick && <Button title='刪除' color='alert' disabled={deleteDisabled} hint={deleteHint} startElement={<img src='/design/ui/delete.svg' alt='' width={20} height={20} />} onClick={deleteOnClick} />}
          {addOnClick && <Button title={addTitle} disabled={addDisabled} hint={addHint} startElement={<img src='/design/ui/plus.svg' alt='' width={20} height={20} />} onClick={addOnClick} />}
        </div>
      </div>
      {children}
    </div>
  );
}

TableTop.propTypes = {
  searchOnChange: PropTypes.func,
  searchPlaceholder: PropTypes.string,
  addOnClick: PropTypes.func,
  addTitle: PropTypes.string,
  addDisabled: PropTypes.bool,
  addHint: PropTypes.string,
  deleteOnClick: PropTypes.func,
  deleteDisabled: PropTypes.bool,
  deleteHint: PropTypes.string,
  children: PropTypes.node,
}

TableTop.defaultProps = {
  searchOnChange: null,
  searchPlaceholder: '依標題搜尋名稱',
  addOnClick: null,
  addTitle: '新增',
  addDisabled: false,
  addHint: undefined,
  deleteOnClick: null,
  deleteDisabled: false,
  deleteHint: undefined,
  children: null,
}

export default TableTop
