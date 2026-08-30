import React, { useState } from 'react'
import PropTypes from 'prop-types'
import Headline from './Headline';
import Card from './Card';
import ErrorText from './ErrorText';
import ContentText from './ContentText';
import Selector from './Selector';
import Input from './Input';
import Icon from './Icon';

/**
 * Primary UI component for user interaction
 *  
 * 
 */


function Search({placeholder, customStyles, onClick, onChange}) {
    const isTailwind = typeof customStyles === 'string';
    const [searchInput, setSearchInput] = useState('');

    const onInputChange = (e) => {
        const value = e.target.value;
        setSearchInput(value);
        if (onChange) onChange(value);
    };

    return (
        <div className={`search ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}}>
            <Icon name='search' customStyles='search-icon' onClick={onClick} />
            <input className='search-input' type="text" name='search' placeholder={placeholder} value={searchInput} onChange={onInputChange} />
        </div>
    )
}

Search.propTypes = {
    placeholder: PropTypes.string,
    customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    onClick: PropTypes.func,
    onChange: PropTypes.func,
}

Search.defaultProps = {
    placeholder: '搜尋',
    customStyles: null,
    onClick:null,
    onChange:null,
}

export default Search
