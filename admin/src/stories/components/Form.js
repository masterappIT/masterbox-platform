import React from 'react';
import PropTypes from 'prop-types';
import Button from './Button';

import { useTranslation } from "react-i18next";


/**
 * Primary UI component for user interaction
 * 
 * @param { any } children any
 * @param { string } customStyles PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
 * @param { func } cancelClick fun
 * @param { func } saveClick fun
 *
 */
function Form({ children, customStyles, cancelClick, saveClick }) {
  const {t}=useTranslation()
  const isTailwind = typeof customStyles === 'string';

  return (
    <div className={`form ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} >
      <div className="form-btnArea">
        <div className="form-btnArea-btnList">
          <Button title={t('cancel')} color='grayscale' onClick={cancelClick} />
          <Button title={t('save')}  color='primary' onClick={saveClick} />
        </div>
      </div>
      {children}
    </div>

  );
};

Form.propTypes = {
  children: PropTypes.any,
  customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]), 
  cancelClick: PropTypes.func,
  saveClick: PropTypes.func,
}

Form.defaultProps = {
  children: null,
  customStyles: null,
  cancelClick: null,
  saveClick: null,
}

export default Form