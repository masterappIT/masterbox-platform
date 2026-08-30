import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

import ListItem from "./ListItem";
import Linebar from "./Linebar";
import Avatar from './Avatar';
import List from './List';
import ContentText from './ContentText';
// import { createPopper } from "@popperjs/core";

const Dropdown = ({ children, border, customStyles, outSideElement, justify, distance }) => {
  // dropdown props
  const [dropdownShow, setDropdownShow] = useState(false);
  const isTailwind = typeof customStyles === 'string';

function handleSetDropDownUnShow(e){
  e.stopPropagation();
  setDropdownShow(false);
}
  useEffect(() => {
    document.addEventListener("click", (e) => setDropdownShow(false));
  }, [])

  return (
    <>
      {/* <div
        className="dropdown"
        onClick={(e) => {
          e.stopPropagation();
          setDropdownShow(!dropdownShow)
        }}
      >
        {children}
      </div>
      <div
        className={
          `dropdown-item ${dropdownShow ? '' : 'hidden'}`
        }
        onClick={(e)=>e.stopPropagation()}
      >
        <List customStyles={`dropdown-item-list dropdown-item-list-${justify} dropdown-item-list-${distance} `}>
          {list&&list.map((value, index) => <ListItem key={index} onClick={(e) => e.preventDefault()} customStyles='whitespace-nowrap cursor-pointer hover:bg-primary_light'><a><ContentText  title={value} size='secondary' color='black-primary'></ContentText></a></ListItem>)}
        </List>

      </div> */}
      <div
        className="dropdown"
        onClick={(e) => {
          e.stopPropagation();
          setDropdownShow(!dropdownShow)
        }}
      >
        {outSideElement}
      </div>
      <div
        className={`dropdown-item ${dropdownShow ? 'overflow-visible' : 'hidden'}`}
        // onClick={(e) => e.stopPropagation()}
        onClick={(e) => handleSetDropDownUnShow(e)}
      >
        <div className={`dropdown-item-list dropdown-item-list-${justify} dropdown-item-list-${distance} ${border?'border border-black_quinary  ':''} ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} >
          {children}
        </div>
      </div>
    </>
  );
};

Dropdown.propTypes = {
  justify: PropTypes.oneOf(['left', 'right', 'center']),
  distance: PropTypes.oneOf(['close', 'normal', 'far']),
  border: PropTypes.bool
}


Dropdown.defaultProps = {
  justify: 'center',
  distance: 'normal',
  border:null,
}


export default Dropdown;
